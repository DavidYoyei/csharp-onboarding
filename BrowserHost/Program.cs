using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

[SupportedOSPlatform("browser")]
public static partial class Program
{
    private const string RegistryPath = "students.txt";
    private static readonly List<MetadataReference> References = new();

    public static void Main() { }

    [JSImport("write", "consoleBridge")]
    private static partial void Write(string text);

    [JSImport("readLine", "consoleBridge")]
    private static partial string? ReadLine();

    [JSImport("saveRegistry", "consoleBridge")]
    private static partial void SaveRegistry(string text);

    [JSImport("beginExecution", "consoleBridge")]
    private static partial void BeginExecution();

    [JSExport]
    public static void LoadReferences(byte[] archive)
    {
        using var zip = new ZipArchive(new MemoryStream(archive));
        foreach (ZipArchiveEntry entry in zip.Entries)
        {
            if (!entry.Name.EndsWith(".dll", StringComparison.Ordinal))
                continue;

            // Zip entry streams aren't seekable. Roslyn reads PE files by offset.
            using var source = entry.Open();
            using var dll = new MemoryStream();
            source.CopyTo(dll);
            dll.Position = 0;
            References.Add(MetadataReference.CreateFromStream(dll));
        }
    }

    [JSExport]
    public static async Task Run(string sourceJson, string? registry)
    {
        var sources = JsonSerializer.Deserialize<Dictionary<string, string>>(sourceJson)!;
        var trees = sources.Select(file => CSharpSyntaxTree.ParseText(file.Value, path: file.Key));
        // The .NET runtime in this worker has a single managed thread.
        var options = new CSharpCompilationOptions(OutputKind.ConsoleApplication, concurrentBuild: false)
            .WithNullableContextOptions(NullableContextOptions.Enable);
        var compilation = CSharpCompilation.Create("Exercise", trees, References, options);

        using var binary = new MemoryStream();
        var result = compilation.Emit(binary);
        if (!result.Success)
        {
            foreach (var diagnostic in result.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error))
                Write(diagnostic + "\n");
            throw new InvalidOperationException("Compilation failed");
        }

        if (registry != null)
            File.WriteAllText(RegistryPath, registry);

        void SyncRegistry()
        {
            if (registry == null)
                return;

            string text = File.Exists(RegistryPath) ? File.ReadAllText(RegistryPath) : "";
            if (text == registry)
                return;

            SaveRegistry(text);
            registry = text;
        }

        Console.SetOut(new BrowserWriter());
        Console.SetError(Console.Out);
        // The browser has no native stdin. The reader supplies it from the worker.
#pragma warning disable CA1416
        Console.SetIn(new BrowserReader(SyncRegistry));
#pragma warning restore CA1416

        // Each run gets a new worker and runtime, so uploaded code has fresh state.
        MethodInfo entry = Assembly.Load(binary.ToArray()).EntryPoint!;
        // C# emits a synchronous wrapper for async Main. Await the actual method
        // so the browser thread never blocks on the wrapper's monitor.
        var entrySymbol = compilation.GetEntryPoint(default)!;
        if (entry.Name != entrySymbol.MetadataName)
        {
            entry = entry.DeclaringType!
                .GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                .Single(method => method.Name == entrySymbol.MetadataName
                    && method.GetParameters().Length == entrySymbol.Parameters.Length
                    && typeof(Task).IsAssignableFrom(method.ReturnType));
        }
        object?[]? args = entry.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() };
        try
        {
            BeginExecution();
            if (entry.Invoke(null, args) is Task pending)
                await pending;
        }
        catch (TargetInvocationException error) when (error.InnerException != null)
        {
            Write($"{error.InnerException.GetType().Name}: {error.InnerException.Message}\n");
            throw new InvalidOperationException("Program failed");
        }
        finally
        {
            SyncRegistry();
        }
    }

    private sealed class BrowserReader(Action beforeRead) : TextReader
    {
        public override string? ReadLine()
        {
            beforeRead();
            return Program.ReadLine();
        }
    }

    private sealed class BrowserWriter : TextWriter
    {
        private int remaining = 64_000;
        public override Encoding Encoding => Encoding.UTF8;

        public override void Write(char value) => Write(value.ToString());

        public override void Write(string? value)
        {
            if (string.IsNullOrEmpty(value) || remaining <= 0)
                return;

            string chunk = value[..Math.Min(value.Length, remaining)];
            remaining -= chunk.Length;
            Program.Write(chunk);
            if (remaining == 0)
                Program.Write("\n[Console output limit reached.]\n");
        }
    }
}

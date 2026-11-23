# C# Onboarding Workspace

[Open the browser workspace](https://davidyoyei.github.io/csharp-onboarding/)

Choose a task, edit the C# source, and select **Run C#**. When a program asks for input, type a line in the console and press Enter. Use **Reset file** to restore the selected source file. Drafts and the Week 1 checklist are stored in the current browser.

| Week | Task |
| --- | --- |
| 1 | Bob Tabor’s C# Fundamentals for Absolute Beginners video series and watch checklist |
| 2 | List exercises, palindrome check, three sums using for, while and foreach, and Guess My Number |
| 3 | Number to Words and Student Registry |

The list exercises count positions starting at 1. Number to Words accepts a signed 64-bit integer. The registry stores sample records as plain text, one ID, name and course per line separated by pipes. Each browser profile has its own students.txt file. Use **Download students.txt** to inspect it.

## Run the console programs locally

Run one of these commands from the repository root with the .NET 10 SDK.

    dotnet run --project Exercises -p:Exercise=ListExercises
    dotnet run --project Exercises -p:Exercise=GuessMyNumber
    dotnet run --project Exercises -p:Exercise=NumberToWords
    dotnet run --project Exercises -p:Exercise=StudentRegistry

The local registry uses students.txt in the directory where you start the program.

## Build the website

    dotnet workload install wasm-tools
    pwsh -File ./build-pages.ps1

Serve the dist folder on HTTPS or localhost. Roslyn compiles the edited source in a Web Worker using .NET WebAssembly. GitHub Actions publishes to GitHub Pages and verifies the public URL with a fresh Chromium session.

using System;
using System.IO;

public class StudentStore
{
    private readonly string filePath;

    public StudentStore(string filePath)
    {
        this.filePath = filePath;
    }

    public void Add(Student student)
    {
        // One pipe-delimited record per line keeps the file easy to inspect.
        string record = $"{student.Id}|{student.Name}|{student.Course}";
        File.AppendAllText(filePath, record + Environment.NewLine);
    }

    public Student? Find(string id)
    {
        if (!File.Exists(filePath))
            return null;

        foreach (string line in File.ReadLines(filePath))
        {
            string[] fields = line.Split('|');
            if (fields.Length == 3 && string.Equals(fields[0], id, StringComparison.OrdinalIgnoreCase))
                return new Student(fields[0], fields[1], fields[2]);
        }

        return null;
    }
}

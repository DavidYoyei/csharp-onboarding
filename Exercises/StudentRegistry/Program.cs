using System;

var store = new StudentStore("students.txt");
while (true)
{
    Console.WriteLine("1. Register student");
    Console.WriteLine("2. Find student by ID");
    Console.WriteLine("3. Exit");
    Console.WriteLine("Choose an option:");
    string? option = Console.ReadLine();

    if (option == null || option.Trim() == "3")
        break;

    try
    {
        if (option.Trim() == "1")
            Register(store);
        else if (option.Trim() == "2")
            Find(store);
        else
            Console.WriteLine("Choose 1, 2 or 3.");
    }
    catch (System.IO.IOException error)
    {
        Console.WriteLine($"Could not access students.txt: {error.Message}");
    }
}

static void Register(StudentStore store)
{
    Console.WriteLine("Student ID:");
    string? id = Console.ReadLine()?.Trim();
    if (string.IsNullOrEmpty(id))
    {
        Console.WriteLine("Student ID is required.");
        return;
    }

    if (store.Find(id) != null)
    {
        Console.WriteLine("That student ID is already registered.");
        return;
    }

    Console.WriteLine("Full name:");
    string? name = Console.ReadLine()?.Trim();
    Console.WriteLine("Course:");
    string? course = Console.ReadLine()?.Trim();

    if (!ValidField(id) || !ValidField(name) || !ValidField(course))
    {
        Console.WriteLine("ID, name and course are required and cannot contain the | character.");
        return;
    }

    store.Add(new Student(id, name!, course!));
    Console.WriteLine("Student registered.");
}

static bool ValidField(string? value)
{
    return !string.IsNullOrEmpty(value) && !value.Contains('|');
}

static void Find(StudentStore store)
{
    Console.WriteLine("Student ID:");
    string? id = Console.ReadLine()?.Trim();
    if (string.IsNullOrEmpty(id))
    {
        Console.WriteLine("Student ID is required.");
        return;
    }

    Student? student = store.Find(id);
    if (student == null)
    {
        Console.WriteLine("Student not found.");
        return;
    }

    Console.WriteLine($"ID: {student.Id}");
    Console.WriteLine($"Name: {student.Name}");
    Console.WriteLine($"Course: {student.Course}");
}

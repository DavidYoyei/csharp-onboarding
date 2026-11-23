public class Student
{
    public string Id { get; }
    public string Name { get; }
    public string Course { get; }

    public Student(string id, string name, string course)
    {
        Id = id;
        Name = name;
        Course = course;
    }
}

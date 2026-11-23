using System;
using System.Globalization;

Console.WriteLine("Enter a whole number, or press Enter to exit.");
while (true)
{
    Console.WriteLine("Number:");
    string? input = Console.ReadLine();
    if (string.IsNullOrWhiteSpace(input))
        break;

    if (long.TryParse(input, NumberStyles.Integer, CultureInfo.InvariantCulture, out long number))
        Console.WriteLine(NumberWords.Convert(number));
    else
        Console.WriteLine("Enter a whole number within the signed 64-bit range.");
}

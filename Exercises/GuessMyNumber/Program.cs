using System;

const int minimum = 1;
const int maximum = 100;
// Random.Next excludes the upper bound.
int target = new Random().Next(minimum, maximum + 1);
int attempts = 0;

Console.WriteLine($"I picked a number from {minimum} to {maximum}.");
while (true)
{
    Console.WriteLine("Enter your guess:");
    string? input = Console.ReadLine();
    if (input == null)
        break;

    if (!int.TryParse(input, out int guess) || guess < minimum || guess > maximum)
    {
        Console.WriteLine($"Enter a whole number from {minimum} to {maximum}.");
        continue;
    }

    attempts++;
    if (guess > target)
        Console.WriteLine("Too high.");
    else if (guess < target)
        Console.WriteLine("Too low.");
    else
    {
        Console.WriteLine($"Correct! Attempts: {attempts}");
        break;
    }
}

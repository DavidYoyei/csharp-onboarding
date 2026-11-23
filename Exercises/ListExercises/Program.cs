using System;
using System.Collections.Generic;

var numbers = new List<int> { 4, -2, 9, 7, 3 };
Console.WriteLine($"List: {string.Join(", ", numbers)}");
Console.WriteLine($"Largest: {ListTasks.Largest(numbers)}");
Console.WriteLine($"Contains 9: {ListTasks.Contains(numbers, 9)}");
Console.WriteLine($"Odd positions: {string.Join(", ", ListTasks.OddPositions(numbers))}");
Console.WriteLine($"Running total: {string.Join(", ", ListTasks.RunningTotal(numbers))}");
Console.WriteLine($"Is 'Never odd or even' a palindrome? {ListTasks.IsPalindrome("Never odd or even")}");
Console.WriteLine($"Sum using for: {ListTasks.SumFor(numbers)}");
Console.WriteLine($"Sum using while: {ListTasks.SumWhile(numbers)}");
Console.WriteLine($"Sum using foreach: {ListTasks.SumForeach(numbers)}");

ListTasks.Reverse(numbers);
Console.WriteLine($"Reversed in place: {string.Join(", ", numbers)}");

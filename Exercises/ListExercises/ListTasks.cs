using System;
using System.Collections.Generic;

public static class ListTasks
{
    public static int Largest(List<int> numbers)
    {
        if (numbers.Count == 0)
            throw new ArgumentException("The list must contain at least one number.", nameof(numbers));

        // Start with a list value so this also works for all-negative lists.
        int largest = numbers[0];
        for (int i = 1; i < numbers.Count; i++)
        {
            if (numbers[i] > largest)
                largest = numbers[i];
        }
        return largest;
    }

    public static void Reverse(List<int> numbers)
    {
        for (int left = 0, right = numbers.Count - 1; left < right; left++, right--)
        {
            int saved = numbers[left];
            numbers[left] = numbers[right];
            numbers[right] = saved;
        }
    }

    public static bool Contains(List<int> numbers, int target)
    {
        foreach (int number in numbers)
        {
            if (number == target)
                return true;
        }
        return false;
    }

    public static List<int> OddPositions(List<int> numbers)
    {
        var result = new List<int>();
        // Position 1 is index 0, so positions 1, 3 and 5 use indexes 0, 2 and 4.
        for (int i = 0; i < numbers.Count; i += 2)
            result.Add(numbers[i]);
        return result;
    }

    public static List<long> RunningTotal(List<int> numbers)
    {
        var totals = new List<long>();
        long total = 0;
        foreach (int number in numbers)
        {
            total += number;
            totals.Add(total);
        }
        return totals;
    }

    public static bool IsPalindrome(string text)
    {
        // Ignore punctuation and spaces so a phrase can be checked as one word.
        var letters = new List<char>();
        foreach (char character in text)
        {
            if (char.IsLetterOrDigit(character))
                letters.Add(char.ToLowerInvariant(character));
        }

        for (int left = 0, right = letters.Count - 1; left < right; left++, right--)
        {
            if (letters[left] != letters[right])
                return false;
        }
        return true;
    }

    public static long SumFor(List<int> numbers)
    {
        long total = 0;
        for (int i = 0; i < numbers.Count; i++)
            total += numbers[i];
        return total;
    }

    public static long SumWhile(List<int> numbers)
    {
        long total = 0;
        int i = 0;
        while (i < numbers.Count)
        {
            total += numbers[i];
            i++;
        }
        return total;
    }

    public static long SumForeach(List<int> numbers)
    {
        long total = 0;
        foreach (int number in numbers)
            total += number;
        return total;
    }
}

using System.Collections.Generic;

public static class NumberWords
{
    private static readonly string[] Units =
    {
        "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
        "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
        "seventeen", "eighteen", "nineteen"
    };

    private static readonly string[] Tens =
    {
        "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"
    };

    private static readonly string[] Scales =
    {
        "", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion"
    };

    public static string Convert(long number)
    {
        if (number == 0)
            return Units[0];

        var parts = new List<string>();
        bool negative = number < 0;
        int scale = 0;
        while (number != 0)
        {
            // Take the absolute value of the group so long.MinValue works too.
            int group = (int)(number % 1000);
            if (group < 0)
                group = -group;

            if (group != 0)
            {
                string words = BelowThousand(group);
                if (scale > 0)
                    words += " " + Scales[scale];
                parts.Add(words);
            }
            number /= 1000;
            scale++;
        }

        if (negative)
            parts.Add("minus");
        parts.Reverse();
        return string.Join(" ", parts);
    }

    private static string BelowThousand(int number)
    {
        if (number < 20)
            return Units[number];

        if (number < 100)
        {
            string tens = Tens[number / 10];
            int ones = number % 10;
            return ones == 0 ? tens : tens + "-" + Units[ones];
        }

        string hundreds = Units[number / 100] + " hundred";
        int remainder = number % 100;
        return remainder == 0 ? hundreds : hundreds + " " + BelowThousand(remainder);
    }
}

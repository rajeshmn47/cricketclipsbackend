function findmax(arr) {
    let max = 0
    let items = {}
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
            let sum = (j - i) * Math.min(arr[i], arr[j])
            if (sum > max) {
                max = sum
                items = {
                    i: arr[i],
                    j: arr[j]
                }
            }
        }
    }
    return max;
}

let arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
let arr2 = [1, 1]
//console.log(findmax(arr));

function longestSubstring(str) {
    let word = "";
    let max = ""
    for (let i = 0; i < str.length; i++) {
        if (!(word.includes(str[i]))) {
            word = word + str[i];
            if (word.length > max.length) {
                max = word;
            }
        }
        else {
            let k = word.indexOf(str[i])
            let p = ""
            console.log(k, word, str, "k")
            for (let j = 0; j < word.length; j++) {
                if (j > k) {
                    //console.log(word[j], "j")
                    p = p + word[j]
                }
            }
            console.log(p, "p")
            word = p + str[i]
        }
    }
    return max;
}

function testpalindrome(num) {
    let nums = num.toString().split("");
    let reverse = ""
    for (let i = (nums.length - 1); i > -1; i--) {
        reverse = reverse + nums[i]
    }
    console.log(reverse)
    if (reverse == num) {
        return true;
    }
    else {
        return false;
    }
}

function mergesortedarrays(arr, brr) {
    let mergedArray = [];
    let length = Math.max(arr.length, brr.length)
    let i = 0;
    let j = 0;
    while (arr.length > 0 && i < (arr.length) && j < (brr.length) && brr.length > 0) {
        if (arr[i] > brr[j]) {
            mergedArray.push(arr[i])
            i++
        }
        else {
            mergedArray.push(brr[j])
            j++
        }
        //console.log(mergedArray, "merged")

    }
    console.log(...brr.slice(j, (brr.length - 1)), "min")
    mergedArray.push(...arr.slice(i, (arr.length)))
    mergedArray.push(...brr.slice(j, (brr.length)))
    let mid = mergedArray.length / 2;
    //let mid = 6
    if (((mid % 2) == 0)) {
        console.log(mergedArray, mid, (mid % 2), "even")
        let median = (mergedArray[Math.ceil(mid) - 1] + mergedArray[Math.floor(mid)]) / 2
        return median;
    }
    else {
        console.log(mergedArray, "odd")
        let median = mergedArray[Math.floor(mid)]
        return median;
    }
}

function getword(num) {
    console.log(num, "num");
    if (num == 0) {
        return ""
    }
    if (num == 1) {
        return "one"
    }
    else if (num == "2") {
        return "two"
    }
    else if (num == 3) {
        return "three"
    }
    else if (num == 4) {
        return "four"
    }
    else if (num == 5) {
        return "five"
    }
    else if (num == 6) {
        return "six"
    }
    else if (num == 7) {
        return "seven"
    }
    else if (num == 8) {
        return "eight"
    }
    else if (num == 9) {
        return "nine"
    }
}

function getteen(num) {
    if (num == 11) {
        return "eleven";
    }
    if (num == 12) {
        return "twelve";
    }
    if (num == 13) {
        return "thirteen";
    }
    if (num == 14) {
        return "fourteen";
    }
    if (num == 15) {
        return "fifteen";
    }
    if (num == 16) {
        return "sixteen";
    }
    if (num == 17) {
        return "seventeen";
    }
    if (num == 18) {
        return "eightteen";
    }
    if (num == 19) {
        return "nineteen";
    }
}

function getety(num) {
    console.log(num, "num");
    if (num == 0) {
        return ""
    }
    if (num == 1) {
        return ""
    }
    else if (num == "2") {
        return "twenty"
    }
    else if (num == 3) {
        return "thirty"
    }
    else if (num == 4) {
        return "forty"
    }
    else if (num == 5) {
        return "fifty"
    }
    else if (num == 6) {
        return "sixty"
    }
    else if (num == 7) {
        return "seventy"
    }
    else if (num == 8) {
        return "eighty"
    }
    else if (num == 9) {
        return "ninty"
    }
}

function convertnumberstoword(number) {
    let stringnumber = number.toString();
    let length = number.toString().length;
    let word = ""
    console.log(length, word, "word")
    let skip = false
    for (let i = 0; i < length; i++) {
        if ((length - 1) - i == 5) {
            let a = getety(stringnumber[i])
            word = a + word + "hundred"
        }
        if ((length - 1) - i == 4) {
            if (stringnumber[i] == 1) {
                skip = true;
                let ban = stringnumber[i] + stringnumber[i + 1]
                console.log(ban, "ban");
                let a = getteen(ban)
                word = word + a + "thousand"
            }
            else {
                skip = true;
                let a = getety(stringnumber[i])
                word = word + a + thousand
            }
        }
        if ((length - 1) - i == 3) {
            //console.log(stringnumber[i], "i");
            if (skip == false) {
                let a = getword(stringnumber[i])
                word = a ? word + a + "thousand" : word
            }
        }
        if ((length - 1) - i == 2) {
            let a = getword(stringnumber[i]);
            word = a ? word + a + "hundred" : word
        }
        if ((length - 1) - i == 1) {
            let a = getety(stringnumber[i]);
            word = a ? (word + " " + (word.length > 0 ? "and" : "") + " " + a) : word
        }
        if ((length - 1) - i == 0) {
            console.log(i, "string");
            let a = getword(stringnumber[i])
            word = a ? word + a : word
        }
    }
    //console.log(word, "word");
    return word;
}

function createstar() {
    for (let i = 0; i < 7; i++) {
        let stars = ""
        for (let j = 1; j <= (2 * i) - 1; j = j + 1) {
            stars = stars + "*"
        }
        let space = ""
        let k = 7 - (((2 * i) - 1)) / 2
        for (let a = 0; a < k; a++) {
            space = space + " "
        }
        stars = space + stars + space
        console.log(stars)
    }
    for (let i = 7; i >= 0; i--) {
        let stars = ""
        for (let j = 0; j <= ((2 * i)); j++) {
            stars = stars + "*"
        }
        let space = ""
        let k = (((2 * (7 - i)) - 1)) / 2
        for (let a = 0; a < k; a++) {
            space = space + " "
        }
        stars = space + stars + space
        console.log(stars)
    }
}

function generatesquare(target) {
    let stars = ""
    for (let j = 0; j < target; j++) {
        stars = stars + "*"
    }
    console.log(stars)
    for (let j = 0; j < (target-2); j++) {
        let v = "*"
        for (let k = 0; k < (target - 2); k++) {
            v = v + " "
        }
        v = v + "*"
        console.log(v)
    }
    stars = ""
    for (let j = 0; j < target; j++) {
        stars = stars + "*"
    }
    console.log(stars)
}

generatesquare(80);

// Example
let arr1 = [45, 34, 20, 10, 5, 3];
let arr3 = [50, 20, 14, 12, 10, 9];
//console.log(mergesortedarrays(arr1, arr3), "max"); // "zybchgdsa"
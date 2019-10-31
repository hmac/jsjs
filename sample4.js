var isAlphaOrUnderscore = function (char) {
    var c = char.charCodeAt(0);
    // 65 - 90  uppercase letters
    // 97 - 122 lowercase letters
    // 95       underscore
    return ((c >= 65 && c <= 90)
        || (c >= 97 && c <= 122)
        || c == 95
    );
};

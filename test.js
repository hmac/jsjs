/*eslint no-implicit-globals: "error"*/
// TODO: use Promises? try...catch appears to be really, really slow in v8.
function parse(input) {
    return many(parseStatement, input);
}
function parseStatement(input) {
    return oneOf([
        parseFunction,
        parseIf,
        parseWhile,
        parseReturn,
        parseComment,
        parseAssign,
    ], input);
    // expr
}
function parseComment(input) {
    input = string("//", input)[0];
    var _a = satisfy(function (c) { return c !== "\n"; }, input), input = _a[0], content = _a[1];
    input = skipSpace(input)[0];
    return [input, { type: "comment", content: content }];
}
// Function definition forms:
//
// function(a, b) { ... }
// function foo(a, b) { ... }
function parseFunction(input) {
    var _a, _b, _c;
    var body;
    var name;
    var args;
    input = token("function", input)[0];
    _a = maybe(function (input) {
        return word(input);
    }, input), input = _a[0], name = _a[1];
    _b = parens(function (input) {
        input = skipSpace(input)[0];
        return sepBy(comma, function (input) { return word(input); }, input);
    }, input), input = _b[0], args = _b[1];
    input = skipSpace(input)[0];
    _c = braces(function (input) {
        input = skipSpace(input)[0];
        return many(function (input) { return parseStatement(input); }, input);
    }, input), input = _c[0], body = _c[1];
    return [input, { type: "function", name: name, body: body, args: args }];
}
function parseAssign(input) {
    input = maybe(function (input) { return token("var", input); }, input)[0];
    var _a = sepBy(comma, function (input) {
        var _a = word(input), input = _a[0], name = _a[1];
        input = token("=", input)[0];
        var _b = parseExpr(input), input = _b[0], val = _b[1];
        return [input, { name: name, value: val }];
    }, input), input = _a[0], assigns = _a[1];
    input = semicolon(input)[0];
    return [input, { type: "assign", assigns: assigns }];
}
function parseReturn(input) {
    input = token("return", input)[0];
    var _a = parseExpr(input), input = _a[0], expr = _a[1];
    input = semicolon(input)[0];
    return [input, { type: "return", value: expr }];
}
function parseIf(input) {
    var _a, _b, _c;
    var cond, then, else_;
    input = token("if", input)[0];
    _a = parens(parseExpr, input), input = _a[0], cond = _a[1];
    _b = parseBlock(input), input = _b[0], then = _b[1];
    _c = maybe(function (input) {
        input = token("else", input)[0];
        return parseBlock(input);
    }, input), input = _c[0], else_ = _c[1];
    return [input, { type: "if", cond: cond, then: then, "else": else_ }];
}
function parseWhile(input) {
    var _a, _b;
    var cond, body;
    input = token("while", input)[0];
    _a = parens(parseExpr, input), input = _a[0], cond = _a[1];
    _b = parseBlock(input), input = _b[0], body = _b[1];
    return [input, { type: "while", cond: cond, body: body }];
}
function parseBlock(input) {
    return braces(function (input) {
        return many(parseStatement, input);
    }, input);
}
function parseExpr(input) {
    return oneOf([
        parseInfixOp,
        parseFunction,
        parseFunCall,
        parseArrIndex,
        parseNumber,
        parseString,
        parseArr,
        parseVar,
    ], input);
}
function parseNumber(input) {
    var isNum = function (char) {
        return char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57;
    };
    var _a = satisfy(isNum, input), input = _a[0], numStr = _a[1];
    if (numStr === "") {
        throw error("a number", input[0]);
    }
    input = skipSpace(input)[0];
    return [input, { type: "number", value: parseInt(numStr) }];
}
function parseString(input) {
    input = string("\"", input)[0];
    var _a = satisfy(function (c) { return c !== "\""; }, input), input = _a[0], str = _a[1];
    input = string("\"", input)[0];
    return [input, { type: "string", value: str }];
}
function parseArr(input) {
    var _a = brackets(function (input) {
        return sepByEnd(comma, parseExpr, input);
    }, input), input = _a[0], elems = _a[1];
    return [input, { type: "array", elements: elems }];
}
function parseVar(input) {
    var _a;
    var v;
    _a = word(input), input = _a[0], v = _a[1];
    return [input, { type: "variable", name: v }];
}
function parseFunCall(input) {
    // All types of Expr except FunCall
    var _a = oneOf([
        function (input) { return parens(parseInfixOp, input); },
        function (input) { return parens(parseFunction, input); },
        parseArrIndex,
        parseVar,
    ], input), input = _a[0], func = _a[1];
    var _b = many(function (input) {
        return parens(function (input) {
            return sepBy(comma, parseExpr, input);
        }, input);
    }, input), input = _b[0], args = _b[1];
    // This is equiv to folding the array of args into nested funcall nodes
    var result = func;
    args.forEach(function (expr) {
        result = { type: "funcall", func: result, args: expr };
    });
    return [input, result];
}
function parseArrIndex(input) {
    // All types of Expr except ArrIndex
    var _a = oneOf([
        function (input) { return parens(parseInfixOp, input); },
        parseFunCall,
        parseNumber,
        parseString,
        parseVar,
    ], input), input = _a[0], arr = _a[1];
    var _b = many(function (input) {
        return brackets(parseExpr, input);
    }, input), input = _b[0], indices = _b[1];
    // This is equiv to folding the array of indices into nested arrindex nodes
    var result = arr;
    indices.forEach(function (expr) {
        result = { type: "arrindex", arr: result, index: expr };
    });
    return [input, result];
}
function parseInfixOp(input) {
    // All types of Expr except InfixOp
    var _a = oneOf([
        parseFunCall,
        parseArrIndex,
        parseNumber,
        parseString,
        parseVar,
    ], input), input = _a[0], left = _a[1];
    var _b = oneOf([
        function (input) { return token("===", input); },
        function (input) { return token("!==", input); },
    ], input), input = _b[0], op = _b[1];
    var _c = oneOf([
        parseNumber,
        parseFunCall,
        parseVar,
        parseArrIndex,
    ], input), input = _c[0], right = _c[1];
    return [input, { type: "infixop", op: op, left: left, right: right }];
}
function many(parser, input) {
    var _a, _b;
    var r;
    var rs = [];
    _a = maybe(parser, input), input = _a[0], r = _a[1];
    while (r !== null) {
        rs.push(r);
        _b = maybe(parser, input), input = _b[0], r = _b[1];
    }
    return [input, rs];
}
function oneOf(parsers, input) {
    var result = null;
    parsers.forEach(function (parser) {
        if (result === null) {
            var _a = maybe(parser, input), i = _a[0], r = _a[1];
            if (r !== null) {
                result = [i, r];
            }
        }
    });
    // if the result is null, try the last parser again to get an error message
    return result || parsers.pop()(input);
}
function maybe(parser, input) {
    try {
        return parser(input);
    }
    catch (_a) {
        return [input, null];
    }
}
function braces(parser, input) {
    return between(function (input) { return token("{", input); }, function (input) { return token("}", input); }, parser, input);
}
function parens(parser, input) {
    return between(function (input) { return token("(", input); }, function (input) { return token(")", input); }, parser, input);
}
function brackets(parser, input) {
    return between(function (input) { return token("[", input); }, function (input) { return token("]", input); }, parser, input);
}
function between(left, right, parser, input) {
    var _a;
    var r;
    input = left(input)[0];
    _a = parser(input), input = _a[0], r = _a[1];
    input = right(input)[0];
    return [input, r];
}
// sepBy (string ",") parseNumber "1,2,3,4" === [1,2,3,4]
function sepBy(sep, parser, input) {
    var _a = parser(input), input = _a[0], first = _a[1];
    var _b = many(function (input) {
        input = sep(input)[0];
        return parser(input);
    }, input), input = _b[0], rest = _b[1];
    rest.unshift(first);
    return [input, rest];
}
// sepByEnd (string ",") parseNumber "1,2,3,4," === [1,2,3,4]
function sepByEnd(sep, parser, input) {
    var _a = parser(input), input = _a[0], first = _a[1];
    var _b = many(function (input) {
        input = sep(input)[0];
        return parser(input);
    }, input), input = _b[0], rest = _b[1];
    input = maybe(sep, input)[0];
    rest.unshift(first);
    return [input, rest];
}
function skipSpace(input) {
    while (input[0] == " " || input[0] == "\n") {
        input = input.slice(1);
    }
    return [input, " "];
}
// Parses a string of characters ending in a space. Consumes the space.
function word(input) {
    var _a, _b;
    var leading, rest;
    var isAlphaOrUnderscore = function (char) {
        var c = char.charCodeAt(0);
        return ((c >= 65 && c <= 90) // uppercase letters
            || (c >= 97 && c <= 122) // lowercase letters
            || c == 95 // underscore
        );
    };
    var isAlphaNumOrUnderscore = function (char) {
        var c = char.charCodeAt(0);
        return (isAlphaOrUnderscore(char)
            || (c >= 48 && c <= 57) // numbers
        );
    };
    _a = satisfy(isAlphaOrUnderscore, input), input = _a[0], leading = _a[1];
    if (leading === "") {
        throw error("alphabetical character or underscore", input[0]);
    }
    _b = satisfy(isAlphaNumOrUnderscore, input), input = _b[0], rest = _b[1];
    input = skipSpace(input)[0];
    return [input, leading + rest];
}
// Consumes the string if it matches the input
function string(str, input) {
    var l = str.length;
    if (input.slice(0, l) !== str) {
        throw error(str, input.slice(0, l));
    }
    return [input.slice(l), str];
}
function comma(input) { return token(",", input); }
function semicolon(input) { return token(";", input); }
// Like string but consumes trailing whitespace
function token(str, input) {
    var _a = string(str, input), input = _a[0], r = _a[1];
    input = skipSpace(input)[0];
    return [input, r];
}
// Parses a string of characters that satisfy the given predicate
function satisfy(pred, input) {
    var _a = many(function (input) {
        if (input.length == 0 || !pred(input[0])) {
            throw error("a character satisfying the predicate", input[0]);
        }
        return [input.slice(1), input[0]];
    }, input), input = _a[0], r = _a[1];
    return [input, r.join("")];
}
function error(expected, actual) {
    return ("Expected '" + expected + "' but found '" + actual + "'");
}
module.exports = { parse: parse, parseStatement: parseStatement, parseExpr: parseExpr, parseInfixOp: parseInfixOp, parseFunCall: parseFunCall, parseArrIndex: parseArrIndex, parseFunction: parseFunction };

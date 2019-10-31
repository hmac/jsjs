/*eslint no-implicit-globals: "error"*/
// TODO: use Promises? try...catch appears to be really, really slow in v8.
// TODO: could combinators be standalone functions?
function State(input) {
    var _this = this;
    // The parse state
    this.raw_input = input;
    this.loc = 0;
    this.parse = (function () {
        var statements = _this.many(_this.parseStatement);
        _this.eof();
        return statements;
    }).bind(this);
    // Comments
    this.parseComment = parseComment.bind(this);
    this.parseLineComment = parseLineComment.bind(this);
    this.parseBlockComment = parseBlockComment.bind(this);
    this.parseInnerComment = parseInnerComment.bind(this);
    this.parseStatement = parseStatement.bind(this);
    this.parseFunction = parseFunction.bind(this);
    this.parseAssign = parseAssign.bind(this);
    this.parseVarDecl = parseVarDecl.bind(this);
    this.parseReturn = parseReturn.bind(this);
    this.parseThrow = parseThrow.bind(this);
    this.parseTryCatch = parseTryCatch.bind(this);
    this.parseIf = parseIf.bind(this);
    this.parseWhile = parseWhile.bind(this);
    this.parseBlock = parseBlock.bind(this);
    this.parseExpr = parseExpr.bind(this);
    this.parseNew = parseNew.bind(this);
    this.parseNumber = parseNumber.bind(this);
    this.parseString = parseString.bind(this);
    this.parseSingleQuotedString = parseSingleQuotedString.bind(this);
    this.parseDoubleQuotedString = parseDoubleQuotedString.bind(this);
    this.parseArr = parseArr.bind(this);
    this.parseObj = parseObj.bind(this);
    this.parseNot = parseNot.bind(this);
    this.parseFunCall = parseFunCall.bind(this);
    this.parseInfixOp = parseInfixOp.bind(this);
    this.parseVar = parseVar.bind(this);
    this.braces = braces.bind(this);
    this.parens = parens.bind(this);
    this.brackets = brackets.bind(this);
    this.comma = function () { return _this.token(","); };
    this.semicolon = function () { return _this.token(";"); };
    this.dot = function () { return _this.token("."); };
    this.eof = eof.bind(this);
    this.skipSpace = skipSpace.bind(this);
    this.word = word.bind(this);
    this.string = string.bind(this);
    this.token = token.bind(this);
    this.satisfy = satisfy.bind(this);
    this.satisfy1 = satisfy1.bind(this);
    // Combinators
    this.maybe = maybe.bind(this);
    this.many = many.bind(this);
    this.oneOf = oneOf.bind(this);
    this.between = between.bind(this);
    this.sepBy = sepBy.bind(this);
    this.sepByEnd = sepByEnd.bind(this);
    // Consume whitespace
    this.skipSpace = skipSpace.bind(this);
    // Consume the string if it matches the input
    this.string = string.bind(this);
    // Core methods
    this.backtrack = function (f) {
        var loc_before = _this.loc;
        try {
            return f();
        }
        catch (err) {
            _this.loc = loc_before;
            throw err;
        }
    };
    this.input = function () { return _this.raw_input.slice(_this.loc); };
    this.consume = function (n) {
        var slice = _this.input().slice(0, n);
        _this.loc += n;
        return slice;
    };
    this.peek = function (n) { return _this.input().slice(0, n); };
    this.error = error.bind(this);
}
function parseStatement() {
    var _this = this;
    return this.oneOf([
        this.parseFunction,
        this.parseIf,
        this.parseWhile,
        this.parseReturn,
        this.parseThrow,
        this.parseTryCatch,
        this.parseComment,
        this.parseAssign,
        this.parseVarDecl,
        function () { var e = _this.parseExpr(); _this.semicolon(); return e; },
    ]);
}
function parseComment() {
    return this.oneOf([this.parseLineComment, this.parseBlockComment]);
}
function parseLineComment() {
    this.string("//");
    var content = this.satisfy(function (c) { return c !== "\n"; });
    this.skipSpace();
    return { type: "comment", content: content };
}
function parseBlockComment() {
    this.string("/*");
    var content = this.parseInnerComment();
    return { type: "comment", content: content };
}
function parseInnerComment() {
    var _this = this;
    var content = this.satisfy(function (c) { return c !== "*"; });
    var star = this.string("*");
    var rest = this.oneOf([function () { return _this.string("/"); }, this.parseInnerComment]);
    this.skipSpace();
    if (rest === "/") {
        return content;
    }
    return content + star + rest;
}
// Function definition forms:
//
// function(a, b) { ... }
// function foo(a, b) { ... }
function parseFunction() {
    var _this = this;
    this.token("function");
    var name = this.maybe(this.word);
    var args = this.parens(function () {
        _this.skipSpace();
        return _this.sepBy(_this.comma, _this.word);
    });
    this.skipSpace();
    var body = this.braces(function () {
        return _this.many(_this.parseStatement);
    });
    return { type: "function", name: name, body: body, args: args };
}
function parseVarDecl() {
    var _this = this;
    this.oneOf([
        function () { return _this.token("var "); },
        function () { return _this.token("let "); },
    ]);
    var assigns = this.sepBy(this.comma, this.parseVar);
    this.semicolon();
    return { type: "vardecl", names: assigns };
}
function parseAssign() {
    var _this = this;
    this.maybe(function () { return _this.oneOf([
        function () { return _this.token("var "); },
        function () { return _this.token("let "); },
    ]); });
    var assigns = this.sepBy(this.comma, function () {
        var name = _this.parseFunCall();
        _this.token("=");
        var val = _this.parseExpr();
        return { name: name, value: val };
    });
    this.semicolon();
    return { type: "assign", assigns: assigns };
}
function parseReturn() {
    this.token("return");
    var expr = this.parseExpr();
    this.semicolon();
    return { type: "return", value: expr };
}
function parseThrow() {
    this.token("throw");
    var expr = this.parseExpr();
    this.semicolon();
    return { type: "throw", value: expr };
}
function parseTryCatch() {
    var _this = this;
    this.token("try");
    var try_block = this.parseBlock();
    this.token("catch");
    var catch_arg = this.maybe(function () { return _this.parens(_this.parseVar); });
    var catch_block = this.parseBlock();
    return { type: "trycatch", try_block: try_block, catch_arg: catch_arg.name, catch_block: catch_block };
}
function parseIf() {
    var _this = this;
    this.token("if");
    var cond = this.parens(this.parseExpr);
    var then = this.parseBlock();
    var else_ = this.maybe(function () {
        _this.token("else");
        return _this.parseBlock();
    });
    return { type: "if", cond: cond, then: then, "else": else_ };
}
function parseWhile() {
    this.token("while");
    var cond = this.parens(this.parseExpr);
    var body = this.parseBlock();
    return { type: "while", cond: cond, body: body };
}
function parseBlock() {
    var _this = this;
    return this.braces(function () { return _this.many(_this.parseStatement); });
}
function parseExpr() {
    var _this = this;
    return this.oneOf([
        this.parseNew,
        this.parseInfixOp,
        this.parseFunction,
        this.parseFunCall,
        this.parseNumber,
        this.parseString,
        this.parseArr,
        this.parseObj,
        this.parseNot,
        function () { return _this.parens(_this.parseExpr); },
        function () { _this.parseComment(); return _this.parseExpr(); },
        this.parseVar,
    ]);
}
function parseMethodCall() {
    var _this = this;
    var obj = this.oneOf([
        this.parseVar,
        (function () { return _this.parens(_this.parseExpr); }),
    ]);
    this.token(".");
    var method = this.parseVar();
    var args = this.parens(function () {
        return _this.sepBy(_this.comma, _this.parseExpr);
    });
    return { type: "methodcall", object: obj, method: method, args: args };
}
function parseNumber() {
    var isNum = function (char) {
        return char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57;
    };
    var numStr = this.satisfy(isNum);
    if (numStr === "") {
        this.error("a number", this.peek(1));
    }
    this.skipSpace();
    return { type: "number", value: parseInt(numStr) };
}
function parseString() {
    var char = this.peek(1);
    if (char === "\"") {
        return this.parseDoubleQuotedString();
    }
    if (char === "'") {
        return this.parseSingleQuotedString();
    }
}
function parseSingleQuotedString() {
    var _this = this;
    var str = this.between(function () { return _this.string("'"); }, function () { return _this.token("'"); }, function () { return _this.many(function () { return _this.oneOf([
        function () { _this.string("\\'"); return "'"; },
        function () { return _this.satisfy1(function (c) { return c !== "'"; }); },
    ]); }); });
    return { type: "string", value: str.join("") };
}
function parseDoubleQuotedString() {
    var _this = this;
    var str = this.between(function () { return _this.string('"'); }, function () { return _this.token('"'); }, function () { return _this.many(function () { return _this.oneOf([
        function () { _this.string('\\"'); return '"'; },
        function () { return _this.satisfy1(function (c) { return c !== '"'; }); },
    ]); }); });
    return { type: "string", value: str.join("") };
}
function parseArr() {
    var _this = this;
    var elems = this.brackets(function () { return _this.sepByEnd(_this.comma, _this.parseExpr); });
    return { type: "array", elements: elems };
}
function parseObj() {
    var _this = this;
    var parseKey = function () { return _this.oneOf([
        function () { return _this.parseString().value; },
        _this.word,
    ]); };
    var parseKVPair = function () {
        var key = parseKey();
        _this.token(":");
        var val = _this.parseExpr();
        return [key, val];
    };
    var elems = this.braces(function () { return _this.sepByEnd(_this.comma, parseKVPair); });
    return { type: "object", elements: elems };
}
function parseNot() {
    this.token("!");
    var e = this.parseExpr();
    return { type: "not", expr: e };
}
function parseVar() {
    var v = this.word();
    return { type: "variable", name: v };
}
function parseNew() {
    this.token("new "); // we require whitespace after 'new'
    var object = this.parseExpr();
    return { type: "new", object: object };
}
function parseFunCall() {
    var _this = this;
    // A variable or parenthesised expr followed by a series of either:
    // function calls (...)
    // arr indices [x]
    // property lookups .y
    var object = this.oneOf([function () { return _this.parseVar(); }, function () { return _this.parens(_this.parseExpr); }]);
    var chain = this.many(function () { return _this.oneOf([
        function () { return _this.brackets(function () { return { type: "arrindex", index: _this.parseExpr() }; }); },
        function () { return _this.parens(function () { return { type: "funcall", args: _this.sepBy(_this.comma, _this.parseExpr) }; }); },
        function () { _this.dot(); return { type: "property", property: _this.word() }; },
    ]); });
    var result = { type: "funcall", object: object, chain: chain };
    return simplifyFunCall(result);
}
function simplifyFunCall(f) {
    // Short-circuit for empty chains
    if (f.chain.length === 0) {
        return f.object;
    }
    return f;
}
function parseInfixOp() {
    var _this = this;
    // All types of Expr except InfixOp
    var operand = function () { return _this.oneOf([
        _this.parseFunCall,
        _this.parseFunction,
        _this.parseNumber,
        _this.parseString,
        _this.parseArr,
        function () { return _this.parens(_this.parseExpr); },
        _this.parseVar,
    ]); };
    var left = operand();
    var op = this.oneOf([
        function () { return _this.token("==="); },
        function () { return _this.token("=="); },
        function () { return _this.token("!=="); },
        function () { return _this.token("+="); },
        function () { return _this.token("+"); },
        function () { return _this.token(">="); },
        function () { return _this.token("<="); },
        function () { return _this.token("&&"); },
        function () { return _this.token("||"); },
    ]);
    var right = this.parseExpr();
    return { type: "infixop", op: op, left: left, right: right };
}
function many(parser) {
    var rs = [];
    var r = this.maybe(parser);
    while (r !== null) {
        rs.push(r);
        r = this.maybe(parser);
    }
    return rs;
}
// TODO: consider removing backtracking from this combinator,
// to improve error messages and perf.
// This way, once we reach an obviously correct parse path (e.g. we parse a
// 'return') we don't backtrack out of it.
// What we can do is catch failure, and continue to the next parser if no input
// has been consumed, otherwise fail.
function oneOf(parsers) {
    var _this = this;
    var result;
    parsers.forEach(function (parser) {
        if (result === undefined) {
            try {
                result = _this.backtrack(parser);
            }
            catch (_a) {
            }
        }
    });
    // if the result is null, try the last parser again to get an error message
    return result || this.backtrack(parsers.pop());
}
function maybe(parser) {
    try {
        return this.backtrack(parser);
    }
    catch (_a) {
        return null;
    }
}
function braces(parser) {
    var _this = this;
    return this.between(function () { return _this.token("{"); }, function () { return _this.token("}"); }, parser);
}
function parens(parser) {
    var _this = this;
    return this.between(function () { return _this.token("("); }, function () { return _this.token(")"); }, parser);
}
function brackets(parser) {
    var _this = this;
    return this.between(function () { return _this.token("["); }, function () { return _this.token("]"); }, parser);
}
function between(left, right, parser) {
    return this.backtrack(function () {
        left();
        var r = parser();
        right();
        return r;
    });
}
// sepBy (string ",") parseNumber "1,2,3,4" === [1,2,3,4]
function sepBy(sep, parser) {
    var first;
    // if the first parse fails, return an empty array
    try {
        this.backtrack(function () { first = parser(); });
    }
    catch (_a) {
        return [];
    }
    var rest = this.many(function () {
        sep();
        return parser();
    });
    rest.unshift(first);
    return rest;
}
// sepByEnd (string ",") parseNumber "1,2,3,4," === [1,2,3,4]
// sepByEnd (string ",") parseNumber "1,2,3,4" === [1,2,3,4]
// sepByEnd (string ",") parseNumber "" === []
function sepByEnd(sep, parser) {
    var elems = this.sepBy(sep, parser);
    this.maybe(sep);
    return elems;
}
function skipSpace() {
    while (this.peek(1) == " " || this.peek(1) == "\n") {
        this.consume(1);
    }
    return null;
}
function eof() {
    var c = this.peek(1);
    if (c === "") {
        return;
    }
    this.error("end of file", c);
}
// Parses a string of characters ending in a space. Consumes the space.
function word() {
    var isAlphaOrUnderscore = function (char) {
        var c = char.charCodeAt(0);
        // 65-90  uppercase letters
        // 97-122 lowercase letters
        // 95     underscore
        return ((c >= 65 && c <= 90)
            || (c >= 97 && c <= 122)
            || c == 95);
    };
    var isAlphaNumOrUnderscore = function (char) {
        var c = char.charCodeAt(0);
        // 48-57 numbers
        return (isAlphaOrUnderscore(char)
            || (c >= 48 && c <= 57));
    };
    var leading = this.satisfy(isAlphaOrUnderscore);
    if (leading === "") {
        this.error("alphabetical character or underscore", this.peek(1));
    }
    var rest = this.satisfy(isAlphaNumOrUnderscore);
    this.skipSpace();
    return (leading + rest);
}
// Consume the string if it matches the input
function string(str) {
    var len = str.length;
    var actual = this.peek(len);
    if (actual !== str) {
        this.error(str, actual);
    }
    return this.consume(len);
}
// Like string but consumes trailing whitespace
function token(str) {
    var r = this.string(str);
    this.skipSpace();
    return r;
}
// Parses a string of characters that satisfy the given predicate
function satisfy(pred) {
    var _this = this;
    var r = this.many(function () {
        var char = _this.peek(1);
        if (char.length == 0 || !pred(char)) {
            _this.error("a character satisfying the predicate", char);
        }
        return _this.consume(1);
    });
    return r.join("");
}
// Parses a non-empty string of characters that satisfy the given predicate
function satisfy1(pred) {
    var s = this.satisfy(pred);
    if (s === "") {
        this.error("at least one character satisfying the predicate", "");
    }
    return s;
}
function error(expected, actual) {
    var line = calcLineNumber(this.raw_input, this.loc);
    throw ("Expected '" + expected + "' but found '" + actual + "' (" + this.loc + ", line " + line + ")");
}
function calcLineNumber(input, loc) {
    var lines = input.split('\n').
        map(function (s) { return s.length; }).
        reduce(function (acc, lineLength) {
        var lines = acc[0], total = acc[1];
        var entry = { start: total, end: total + lineLength };
        lines.push(entry);
        return [lines, entry.end];
    }, [[], 0])[0];
    return lines.findIndex(function (l) { return loc >= l.start && loc <= l.end; }) + 1;
}
module.exports = { State: State };

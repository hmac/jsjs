function State(input) {
    var _this = this;
    // The parse state
    this.raw_input = input;
    this.loc = 0;
    this.parse = (function () { return _this.many(_this.parseStatement); }).bind(this);
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
    this.parseIf = parseIf.bind(this);
    this.parseWhile = parseWhile.bind(this);
    this.parseBlock = parseBlock.bind(this);
    this.parseExpr = parseExpr.bind(this);
    this.parseNew = parseNew.bind(this);
    this.parseNumber = parseNumber.bind(this);
    this.parseString = parseString.bind(this);
    this.parseArr = parseArr.bind(this);
    this.parseObj = parseObj.bind(this);
    this.parseFunCall = parseFunCall.bind(this);
    this.parseInfixOp = parseInfixOp.bind(this);
    this.parseVar = parseVar.bind(this);
    this.braces = braces.bind(this);
    this.parens = parens.bind(this);
    this.brackets = brackets.bind(this);
    this.comma = function () { return _this.token(","); };
    this.semicolon = function () { return _this.token(";"); };
    this.dot = function () { return _this.string("."); }; // no spaces around dot
    this.skipSpace = skipSpace.bind(this);
    this.word = word.bind(this);
    this.string = string.bind(this);
    this.token = token.bind(this);
    this.satisfy = satisfy.bind(this);
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

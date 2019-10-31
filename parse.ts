/*eslint no-implicit-globals: "error"*/
// TODO: use Promises? try...catch appears to be really, really slow in v8.
// TODO: could combinators be standalone functions?

type Result<T> = [string, T];
type Parser<T> = () => T;

function State(input : string) {
  // The parse state
  this.raw_input = input;
  this.loc = 0;

  this.parse = (() => {
    let statements = this.many(this.parseStatement);
    this.eof();
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
  this.parseWhile = parseWhile.bind(this)
  this.parseBlock = parseBlock.bind(this)
  this.parseExpr = parseExpr.bind(this)
  this.parseNew = parseNew.bind(this)
  this.parseNumber = parseNumber.bind(this)
  this.parseString = parseString.bind(this)
  this.parseSingleQuotedString = parseSingleQuotedString.bind(this)
  this.parseDoubleQuotedString = parseDoubleQuotedString.bind(this)
  this.parseArr = parseArr.bind(this)
  this.parseObj = parseObj.bind(this)
  this.parseNot = parseNot.bind(this)
  this.parseFunCall = parseFunCall.bind(this)
  this.parseInfixOp = parseInfixOp.bind(this)
  this.parseVar = parseVar.bind(this);

  this.braces = braces.bind(this)
  this.parens = parens.bind(this);
  this.brackets = brackets.bind(this);
  this.comma = () => this.token(",");
  this.semicolon = () => this.token(";");
  this.dot = () => this.token(".");

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
  this.try = <T>(f : () => T) : T => {
    let loc_before = this.loc;
    try {
      return f();
    } catch(err) {
      this.loc = loc_before;
      throw err;
    }
  };

  this.input = () : string => this.raw_input.slice(this.loc);

  this.consume = (n : number) : string => {
    var slice = this.input().slice(0, n);
    this.loc += n;
    return slice;
  };

  this.peek = (n : number) : string => this.input().slice(0, n);

  this.error = error.bind(this);
}

type Statement = Func | Comm | Assign | VarDecl | Return | If | While;
function parseStatement() : Statement {
  return this.oneOf([
    <Parser<Statement>>this.parseFunction,
    <Parser<Statement>>this.parseIf,
    <Parser<Statement>>this.parseWhile,
    <Parser<Statement>>this.parseReturn,
    <Parser<Statement>>this.parseThrow,
    <Parser<Statement>>this.parseTryCatch,
    <Parser<Statement>>this.parseComment,
    () => this.try(this.parseAssign),
    () => this.try(this.parseVarDecl),
    () => this.try(() => { let e = this.parseExpr(); this.semicolon(); return e }),
  ]);
}

type Comm = {type : string, content : string};
function parseComment() : Comm {
  return this.oneOf([this.parseLineComment, this.parseBlockComment]);
}

function parseLineComment() : Comm {
  this.string("//");
  let content = this.satisfy((c : string) => c !== "\n");
  this.skipSpace();
  return { type: "comment", content: content };
}

function parseBlockComment() : Comm {
  this.string("/*");
  let content = this.parseInnerComment();
  return { type: "comment", content: content };
}

function parseInnerComment() : string {
  let content = this.satisfy((c : string) => c !== "*");
  let star = this.string("*");
  let rest = this.oneOf([() => this.string("/"), this.parseInnerComment]);
  this.skipSpace();
  if (rest === "/") {
      return content;
  }
  return content + star + rest;
}

type Func = {type: string, name?: string, args: [string], body: [Statement] };

// Function definition forms:
//
// function(a, b) { ... }
// function foo(a, b) { ... }
function parseFunction() : Func {
  this.token("function");

  let name : string | null = this.maybe(this.word);

  let args = this.parens(() => {
    this.skipSpace();
    return this.sepBy(this.comma, this.word);
  });
  this.skipSpace();

  let body = this.braces(() =>
    this.many(this.parseStatement)
  );

  return { type: "function", name: name, body: body, args: args };
}

type VarDecl = {type : string, names : string[]};
function parseVarDecl() : VarDecl {
  this.oneOf([
    () => this.token("var "),
    () => this.token("let "),
    // const
  ]);
  var assigns = this.sepBy(this.comma, this.parseVar);
  this.semicolon();
  return {type: "vardecl", names: assigns};
}

type Assign = {type : string, assigns: {object : Expr, value : Expr}[]};
function parseAssign() : Assign {
  this.maybe(() => this.oneOf([
    () => this.token("var "),
    () => this.token("let "),
  ]));
  var assigns = this.sepBy(this.comma, () => {
    let name = this.parseFunCall();
    this.token("=");
    let val = this.parseExpr();
    return {name: name, value: val};
  });
  this.semicolon();

  return { type: "assign", assigns: assigns };
}

type Return = {type : string, value? : Expr};
function parseReturn() : Return {
  this.token("return");
  let expr = this.maybe(this.parseExpr);
  this.semicolon();
  return { type: "return", value: expr };
}

type Throw = {type: string, value: Expr};
function parseThrow() : Throw {
  this.token("throw");
  let expr = this.parseExpr();
  this.semicolon();
  return { type: "throw", value: expr };
}

type TryCatch = {type : string, try_block : Statement[], catch_arg? : string, catch_block: Statement[]};
function parseTryCatch() : TryCatch {
  this.token("try");
  let try_block = this.parseBlock();
  this.token("catch");
  let catch_arg = this.maybe(() => this.parens(this.parseVar));
  let catch_block = this.parseBlock();
  return {type: "trycatch", try_block: try_block, catch_arg: catch_arg.name, catch_block: catch_block};
}

type If = {type : string, cond : Expr, then : Statement[], else? : Statement[]};
function parseIf() : If {
  this.token("if");
  let cond = this.parens(this.parseExpr);
  let then = this.parseBlock();
  let else_ = this.maybe(() => {
    this.token("else");
    return this.parseBlock();
  });
  return {type: "if", cond: cond, then: then, else: else_};
}

type While = {type : string, cond : Expr, body : Statement[]};
function parseWhile() : While {
  this.token("while");
  let cond = this.parens(this.parseExpr);
  let body = this.parseBlock();
  return {type: "while", cond: cond, body: body};
}

function parseBlock() : Statement[] {
  return this.braces(() => this.many(this.parseStatement));
}

type Expr = Num | Str | Arr | Var | FunCall | ArrIndex | InfixOp | Func;
function parseExpr() : Expr {
  return this.oneOf([
    <Parser<Expr>>this.parseNew,
    () => this.try(this.parseInfixOp),
    <Parser<Expr>>this.parseFunction,
    () => this.try(this.parseFunCall),
    <Parser<Expr>>this.parseNumber,
    <Parser<Expr>>this.parseString,
    <Parser<Expr>>this.parseArr,
    <Parser<Expr>>this.parseObj,
    this.parseNot,
    () => this.parens(this.parseExpr),
    () => { this.parseComment(); return this.parseExpr() },
    () => this.try(this.parseVar),
  ]);
}

function parseMethodCall() : MethodCall {
  let obj = this.oneOf([
    <Parser<Expr>>(() => this.parens(this.parseExpr)),
    () => this.try(this.parseVar),
  ]);

  this.token(".");

  let method = this.parseVar();

  let args = this.parens(() =>
    this.sepBy(this.comma, this.parseExpr)
  );

  return {type: "methodcall", object: obj, method: method, args: args};
}

type Num = {type : string, value : number};
function parseNumber() : Num {
  var isNum = function(char : string) : boolean {
    return char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57;
  }
  let numStr = this.satisfy(isNum);
  if (numStr === "") { this.error("a number", this.peek(1)); }
  this.skipSpace();
  return {type: "number", value: parseInt(numStr)};
}

type Str = {type : string, value : string};
function parseString() : Str {
  let char = this.peek(1);
  if (char === "\"") {
    return this.parseDoubleQuotedString();
  }
  if (char === "'") {
    return this.parseSingleQuotedString();
  }
}

function parseSingleQuotedString() : Str {
  let str = this.between(
    () => this.string("'"),
    () => this.token("'"),
    () => this.many(() => this.oneOf([
      () => { this.string("\\'"); return "'"; },
      () => this.satisfy1((c : string) => c !== "'"),
    ])),
  );
  return {type: "string", value: str.join("")};
}

function parseDoubleQuotedString() : Str {
  let str = this.between(
    () => this.string('"'),
    () => this.token('"'),
    () => this.many(() => this.oneOf([
      () => { this.string('\\"'); return '"'; },
      () => this.satisfy1((c : string) => c !== '"'),
    ])),
  );
  return {type: "string", value: str.join("")};
}

type Arr = {type : string, elements : Expr[]};
function parseArr() : Arr {
  let elems = this.brackets(() => this.sepByEnd(this.comma, this.parseExpr));
  return {type: "array", elements: elems};
}

type Obj = {type : string, elements : [string, Expr]};
function parseObj() : Obj {
  let parseKey = () : string => this.oneOf([
    () => this.parseString().value,
    this.word,
  ]);
  let parseKVPair = () => {
    let key = parseKey();
    this.token(":");
    let val = this.parseExpr();
    return [key, val];
  };
  let elems = this.braces(() => this.sepByEnd(this.comma, parseKVPair));
  return {type: "object", elements: elems};
}

type Not = {type : string, expr: Expr};
function parseNot() : Not {
  this.token("!");
  let e = this.parseExpr();
  return {type: "not", expr: e};
}

type Var = {type : string, name : string};
function parseVar() : Var {
  let v = this.word();
  return { type: "variable", name: v };
}

type New = {type : string, object : Var};
function parseNew() : New {
  this.token("new "); // we require whitespace after 'new'
  let object = this.parseExpr();
  return { type: "new", object: object };
}

type ArrIndex = {type : string, arr : Expr, index : Expr};
type MethodCall = {type : string, object : Expr, method : Var, args : Expr[]}
type FunCall = {type : string, object : Expr, chain : Expr[]};
type Property = {type : string, property : string};
function parseFunCall() : Expr {
  // A variable or parenthesised expr followed by a series of either:
  // function calls (...)
  // arr indices [x]
  // property lookups .y
  let object = this.oneOf([() => this.parseVar(), () => this.parens(this.parseExpr)]);
  let chain = this.many(() => this.oneOf([
    () => this.brackets(() => { return {type: "arrindex", index: this.parseExpr() }; }),
    () => this.parens(() => { return {type: "funcall", args: this.sepBy(this.comma, this.parseExpr)}; }),
    () => { this.dot(); return {type: "property", property: this.word() }; },
  ]));

  let result = {type: "funcall", object: object, chain: chain};
  return simplifyFunCall(result);
}

function simplifyFunCall(f : FunCall) : Expr {
  // Short-circuit for empty chains
  if (f.chain.length === 0) {
    return f.object;
  }
  return f;
}

type InfixOp = {type : string, op : string, left : Expr, right : Expr};
function parseInfixOp() : InfixOp {
  // All types of Expr except InfixOp
  let operand = () => this.oneOf([
    <Parser<Expr>>this.parseFunCall,
    <Parser<Expr>>this.parseFunction,
    <Parser<Expr>>this.parseNumber,
    <Parser<Expr>>this.parseString,
    <Parser<Expr>>this.parseArr,
    () => this.parens(this.parseExpr),
    <Parser<Expr>>this.parseVar,

  ])

  let left = operand();
  let op = this.oneOf([
    () => this.token("==="),
    () => this.token("=="),
    () => this.token("!=="),
    () => this.token("+="),
    () => this.token("+"),
    () => this.token(">="),
    () => this.token("<="),
    () => this.token("<"),
    () => this.token(">"),
    () => this.token("&&"),
    () => this.token("||"),
    // more here
  ]);
  let right = this.parseExpr();
  return {type: "infixop", op: op, left: left, right: right};
}

function many<T>(parser : Parser<T>) : Array<T> {
  var rs = [];
  var r = this.maybe(parser);
  while (r !== null) {
    rs.push(r);
    r = this.maybe(parser);
  }
  return rs;
}

function oneOf<T>(parsers: Parser<T>[]) : T {
  var result : T;
  parsers.forEach((parser) => {
    if (result === undefined) {
      let loc_before = this.loc;
      try {
        result = parser();
      }
      catch (err) {
        if (loc_before < this.loc) {
          // We have consumed input, so fail
          throw err;
        }
        // Otherwise, continue to the next parser
      }
    }
  });
  // if the result is null, try the last parser again to get an error message
  return result || this.try(parsers.pop());
}

function maybe<T>(parser : Parser<T>) : T | null {
  try {
    return this.try(parser);
  }
  catch {
    return null;
  }
}

function braces<T>(parser : Parser<T>) : T {
  return this.between(
    () => this.token("{"),
    () => this.token("}"),
    parser,
  )
}

function parens<T>(parser : Parser<T>) : T {
  return this.between(
    () => this.token("("),
    () => this.token(")"),
    parser,
  )
}

function brackets<T>(parser : Parser<T>) : T {
  return this.between(
    () => this.token("["),
    () => this.token("]"),
    parser,
  )
}

function between<T>(left : Parser<string>, right : Parser<string>, parser : Parser<T>) : T {
  return this.try(() => {
    left();
    let r = parser();
    right();
    return r;
  });
}

// sepBy (string ",") parseNumber "1,2,3,4" === [1,2,3,4]
function sepBy<T>(sep : Parser<string>, parser : Parser<T>) : T[] {
  let first : T;
  // if the first parse fails, return an empty array
  try {
    this.try(() => { first = parser(); });
  }
  catch {
    return []
  }

  var rest = this.many(() => {
    sep();
    return parser();
  });
  rest.unshift(first);
  return rest;
}

// sepByEnd (string ",") parseNumber "1,2,3,4," === [1,2,3,4]
// sepByEnd (string ",") parseNumber "1,2,3,4" === [1,2,3,4]
// sepByEnd (string ",") parseNumber "" === []
function sepByEnd<T>(sep : Parser<string>, parser : Parser<T>) : T[] {
  let elems = this.sepBy(sep, parser);
  this.maybe(sep);
  return elems;
}

function skipSpace() : void {
  while (this.peek(1) == " " || this.peek(1) == "\n") {
    this.consume(1);
  }
  return null;
}

function eof() : void {
  let c = this.peek(1);
  if (c === "") {
    return;
  }
  this.error("end of file", c);
}

// Parses a string of characters ending in a space. Consumes the space.
function word() : string {
  let isAlphaOrUnderscore = function(char : string) : boolean {
    let c = char.charCodeAt(0);
    // 65-90  uppercase letters
    // 97-122 lowercase letters
    // 95     underscore
    return (
      (c >= 65 && c <= 90)
      || (c >= 97 && c <= 122)
      || c == 95
    );
  };
  let isAlphaNumOrUnderscore = function(char : string) : boolean {
    let c = char.charCodeAt(0);
    // 48-57 numbers
    return (
      isAlphaOrUnderscore(char)
      || (c >= 48 && c <= 57)
    );
  };
  let leading = this.satisfy(isAlphaOrUnderscore);
  if (leading === "") {
    this.error("alphabetical character or underscore", this.peek(1));
  }
  let rest = this.satisfy(isAlphaNumOrUnderscore);
  this.skipSpace();
  return (leading + rest);
}

// Consume the string if it matches the input
function string(str : string) : string {
  let len = str.length;
  let actual = this.peek(len);
  if (actual !== str) {
    this.error(str, actual);
  }
  return this.consume(len);
}

// Like string but consumes trailing whitespace
function token(str : string) : string {
  let r = this.string(str);
  this.skipSpace();
  return r;
}

// Parses a string of characters that satisfy the given predicate
function satisfy(pred : (input : string) => boolean) : string {
  let r = this.many(() => {
    let char = this.peek(1);
    if (char.length == 0 || !pred(char)) {
      this.error("a character satisfying the predicate", char);
    }
    return this.consume(1);
  });

  return r.join("");
}

// Parses a non-empty string of characters that satisfy the given predicate
function satisfy1(pred : (input : string) => boolean) : string {
  let s = this.satisfy(pred);
  if (s === "") {
    this.error("at least one character satisfying the predicate", "");
  }
  return s;
}

function error(expected : string, actual : string) : void {
  let line = calcLineNumber(this.raw_input, this.loc);
  throw ("Expected '" + expected + "' but found '" + actual + "' (" + this.loc +", line " + line + ")");
}

function calcLineNumber(input : string, loc : number) : number {
  type LineLoc = {start : number, end : number};
  let [lines, ] = input.split('\n').
    map((s) => s.length).
    reduce((acc : [LineLoc[], number], lineLength : number) => {
    let [lines, total] = acc;
    let entry = {start: total, end: total + lineLength};
    lines.push(entry);
    return [lines, entry.end];
  }, [[], 0]);
  return (<LineLoc[]>lines).findIndex((l : LineLoc) => loc >= l.start && loc <= l.end) + 1;
}



module.exports = {State: State}

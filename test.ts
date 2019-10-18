/*eslint no-implicit-globals: "error"*/
// TODO: use Promises? try...catch appears to be really, really slow in v8.

type Result<T> = [string, T];
type Parser<T> = (input : string) => Result<T>;

function parse(input : string) {
  return many(parseStatement, input);
}

type Statement = Func | Comm | Assign | Return | If | While;
function parseStatement(input : string) : Result<Statement> {
  return oneOf([
    <Parser<Statement>>parseFunction,
    <Parser<Statement>>parseIf,
    <Parser<Statement>>parseWhile,
    <Parser<Statement>>parseReturn,
    <Parser<Statement>>parseComment,
    <Parser<Statement>>parseAssign,
  ], input);
  // expr
}

type Comm = {type : string, content : string};
function parseComment(input : string) : Result<Comm> {
  [input, ] = string("//", input);
  var [input, content] = satisfy(function(c) { return c !== "\n"; }, input);
  [input, ] = skipSpace(input);
  return [input, {type: "comment", content: content}];
}

type Func = {type: string, name?: string, args: [string], body: [Statement] };

// Function definition forms:
//
// function(a, b) { ... }
// function foo(a, b) { ... }
function parseFunction(input : string) : Result<Func> {
  var body;
  var name;
  var args;
  [input, ] = token("function", input);

  [input, name] = maybe(function(input) {
    return word(input);
  }, input);

  [input, args] = parens(function(input : string) {
    [input, ] = skipSpace(input);
    return sepBy(
      comma,
      function(input) { return word(input); },
      input
    )
  }, input);
  [input, ] = skipSpace(input);

  [input, body] = braces(function(input) {
    [input, ] = skipSpace(input);
    return many(
      function(input) { return parseStatement(input); },
      input
    );
  }, input);
  return [input, { type: "function", name: name, body: body, args: args }];
}

type Assign = {type : string, assigns: {name : string, value : Expr}[]};
function parseAssign(input : string) : Result<Assign> {
  [input, ] = maybe(function(input) { return token("var", input) }, input);
  var [input, assigns] = sepBy(comma, function(input : string) {
    var [input, name] = word(input);
    [input, ] = token("=", input);
    var [input, val] = parseExpr(input);
    return [input, {name: name, value: val}];
  }, input);
  [input, ] = semicolon(input);

  return [input, { type: "assign", assigns: assigns }];
}

type Return = {type : string, value : Expr};
function parseReturn(input : string) : Result<Return> {
  [input, ] = token("return", input);
  var [input, expr] = parseExpr(input);
  [input, ] = semicolon(input);
  return [input, { type: "return", value: expr }];
}

type If = {type : string, cond : Expr, then : Statement[], else? : Statement[]};
function parseIf(input : string) : Result<If> {
  var cond : Expr, then : Statement[], else_ : Statement[] | null;
  [input, ] = token("if", input);
  [input, cond] = parens(parseExpr, input);
  [input, then] = parseBlock(input);
  [input, else_] = maybe(function(input) {
    [input, ] = token("else", input);
    return parseBlock(input);
  }, input);
  return [input, {type: "if", cond: cond, then: then, else: else_}];
}

type While = {type : string, cond : Expr, body : Statement[]};
function parseWhile(input : string) : Result<While> {
  var cond : Expr, body : Statement[];
  [input, ] = token("while", input);
  [input, cond] = parens(parseExpr, input);
  [input, body] = parseBlock(input);
  return [input, {type: "while", cond: cond, body: body}];
}

function parseBlock(input : string) : Result<Statement[]> {
  return braces(function(input) {
    return many(parseStatement, input);
  }, input);
}

type Expr = Num | Str | Arr | Var | FunCall | ArrIndex | InfixOp | Func;
function parseExpr(input : string) : Result<Expr> {
  return oneOf([
    <Parser<Expr>>parseInfixOp,
    <Parser<Expr>>parseFunction,
    <Parser<Expr>>parseFunCall,
    <Parser<Expr>>parseArrIndex,
    <Parser<Expr>>parseNumber,
    <Parser<Expr>>parseString,
    <Parser<Expr>>parseArr,
    <Parser<Expr>>parseVar,
  ], input);
}

type Num = {type : string, value : number};
function parseNumber(input : string) : Result<Num> {
  var isNum = function(char : string) : boolean {
    return char.charCodeAt(0) >= 48 && char.charCodeAt(0) <= 57;
  }
  var [input, numStr] = satisfy(isNum, input);
  if (numStr === "") { throw error("a number", input[0]); }
  [input, ] = skipSpace(input);
  return [input, {type: "number", value: parseInt(numStr)}];
}

type Str = {type : string, value : string};
function parseString(input : string) : Result<Str> {
  [input, ] = string("\"", input);
  var [input, str] = satisfy(function(c) { return c !== "\"" }, input);
  [input, ] = string("\"", input);
  return [input, {type: "string", value: str}];
}

type Arr = {type : string, elements : Expr[]};
function parseArr(input : string) : Result<Arr> {
  var [input, elems] = brackets(function(input) {
    return sepByEnd(comma, parseExpr, input);
  }, input);
  return [input, {type: "array", elements: elems}];
}

type Var = {type : string, name : string};
function parseVar(input : string) : Result<Var> {
  var v : string;
  [input, v] = word(input);
  return [input, { type: "variable", name: v }];
}

type FunCall = {type : string, func : Expr, args : Expr[]};
function parseFunCall(input : string) : Result<FunCall> {
  // All types of Expr except FunCall
  var [input, func] = oneOf([
    <Parser<Expr>>function(input) { return parens(parseInfixOp, input); },
    <Parser<Expr>>function(input) { return parens(parseFunction, input); },
    <Parser<Expr>>parseArrIndex,
    <Parser<Expr>>parseVar,
  ], input);

  var [input, args] = many(function(input) {
    return parens(function(input) {
      return sepBy(comma, parseExpr, input);
    }, input);
  }, input);

  // This is equiv to folding the array of args into nested funcall nodes
  var result = func;
  args.forEach(function(expr) {
    result = {type: "funcall", func: result, args: expr};
  })
  return [input, <FunCall>result];
}

type ArrIndex = {type : string, arr : Expr, index : Expr};
function parseArrIndex(input : string) : Result<ArrIndex> {
  // All types of Expr except ArrIndex
  var [input, arr] = oneOf([
    <Parser<Expr>>function(input) { return parens(parseInfixOp,input); },
    <Parser<Expr>>parseFunCall,
    <Parser<Expr>>parseNumber,
    <Parser<Expr>>parseString,
    <Parser<Expr>>parseVar,
  ], input);
  var [input, indices] = many(function(input) {
    return brackets(parseExpr, input);
  }, input);

  // This is equiv to folding the array of indices into nested arrindex nodes
  var result = arr;
  indices.forEach(function(expr) {
    result = {type: "arrindex", arr: result, index: expr};
  })
  return [input, <ArrIndex>result];
}

type InfixOp = {type : string, op : string, left : Expr, right : Expr};
function parseInfixOp(input : string) : Result<InfixOp> {
  // All types of Expr except InfixOp
  var [input, left] = oneOf([
    <Parser<Expr>>parseFunCall,
    <Parser<Expr>>parseArrIndex,
    <Parser<Expr>>parseNumber,
    <Parser<Expr>>parseString,
    <Parser<Expr>>parseVar,
  ], input);
  var [input, op] = oneOf([
    function(input) { return token("===", input); },
    function(input) { return token("!==", input); },
    // more here
  ], input);
  var [input, right] = oneOf([
    <Parser<Expr>>parseNumber,
    <Parser<Expr>>parseFunCall,
    <Parser<Expr>>parseVar,
    <Parser<Expr>>parseArrIndex,
  ], input);
  return [input, {type: "infixop", op: op, left: left, right: right}];
}

function many<T>(parser : Parser<T>, input : string) : Result<Array<T>> {
  var r : T;
  var rs = [];
  [input, r] = maybe(parser, input);
  while (r !== null) {
    rs.push(r);
    [input, r] = maybe(parser, input);
  }
  return [input, rs];
}

function oneOf<T>(parsers: Parser<T>[], input : string) : Result<T> {
  var result : Result<T> = null;
  parsers.forEach(function(parser) {
    if (result === null) {
      var [i, r] = maybe(parser, input);
      if (r !== null) { result = [i, r]; }
    }
  });
  // if the result is null, try the last parser again to get an error message
  return result || parsers.pop()(input);
}

function maybe<T>(parser : Parser<T>, input : string) : Result<T | null> {
  try {
    return parser(input);
  }
  catch {
    return [input, null];
  }
}

function braces<T>(parser : Parser<T>, input : string) : Result<T> {
  return between(
    function(input : string) { return token("{", input) },
    function(input : string) { return token("}", input) },
    parser,
    input
  )
}

function parens<T>(parser : Parser<T>, input : string) : Result<T> {
  return between(
    function(input : string) { return token("(", input) },
    function(input : string) { return token(")", input) },
    parser,
    input
  )
}

function brackets<T>(parser : Parser<T>, input : string) : Result<T> {
  return between(
    function(input : string) { return token("[", input) },
    function(input : string) { return token("]", input) },
    parser,
    input
  )
}

function between<T>(left : Parser<string>, right : Parser<string>, parser : Parser<T>, input : string) : Result<T> {
  var r;
  [input, ] = left(input);
  [input, r] = parser(input);
  [input, ] = right(input);
  return [input, r];
}

// sepBy (string ",") parseNumber "1,2,3,4" === [1,2,3,4]
function sepBy<T>(sep : Parser<string>, parser : Parser<T>, input : string) : Result<T[]> {
  var [input, first] = parser(input);
  var [input, rest] = many(function(input) {
    [input, ] = sep(input);
    return parser(input);
  }, input);
  rest.unshift(first);
  return [input, rest];
}

// sepByEnd (string ",") parseNumber "1,2,3,4," === [1,2,3,4]
function sepByEnd<T>(sep : Parser<string>, parser : Parser<T>, input : string) : Result<T[]> {
  var [input, first] = parser(input);
  var [input, rest] = many(function(input) {
    [input, ] = sep(input);
    return parser(input);
  }, input);
  [input, ] = maybe(sep, input);
  rest.unshift(first);
  return [input, rest];
}

function skipSpace(input : string) : Result<string> {
  while (input[0] == " " || input[0] == "\n") {
    input = input.slice(1);
  }
  return [input, " "];
}

// Parses a string of characters ending in a space. Consumes the space.
function word(input : string) : Result<string> {
  var leading : string, rest : string;
  let isAlphaOrUnderscore = function(char : string) : boolean {
    let c = char.charCodeAt(0);
    return (
      (c >= 65 && c <= 90) // uppercase letters
      || (c >= 97 && c <= 122) // lowercase letters
      || c == 95 // underscore
    );
  };
  let isAlphaNumOrUnderscore = function(char : string) : boolean {
    let c = char.charCodeAt(0);
    return (
      isAlphaOrUnderscore(char)
      || (c >= 48 && c <= 57) // numbers
    );
  };
  [input, leading] = satisfy(isAlphaOrUnderscore, input);
  if (leading === "") {
    throw error("alphabetical character or underscore", input[0]);
  }
  [input, rest] = satisfy(isAlphaNumOrUnderscore, input);
  [input, ] = skipSpace(input);
  return [input, leading + rest];
}

// Consumes the string if it matches the input
function string(str : string, input : string) : Result<string> {
  let l = str.length;
  if (input.slice(0, l) !== str) {
    throw error(str, input.slice(0, l));
  }
  return [input.slice(l), str];
}

function comma(input : string) : Result<string> { return token(",", input); }
function semicolon(input : string) : Result<string> { return token(";", input); }

// Like string but consumes trailing whitespace
function token(str : string, input : string) : Result<string> {
  var [input, r] = string(str, input);
  [input, ] = skipSpace(input);
  return [input, r];
}

// Parses a string of characters that satisfy the given predicate
function satisfy(pred : (input : string) => boolean, input : string) : Result<string> {
  var [input, r] = many(function(input) {
    if (input.length == 0 || !pred(input[0])) {
      throw error("a character satisfying the predicate", input[0]);
    }
    return [input.slice(1), input[0]];
  },
  input
  );

  return [input, r.join("")];
}

function error(expected : string, actual : string) : string {
  return ("Expected '" + expected + "' but found '" + actual + "'");
}

module.exports = {parse: parse, parseStatement: parseStatement, parseExpr: parseExpr, parseInfixOp: parseInfixOp, parseFunCall: parseFunCall, parseArrIndex: parseArrIndex, parseFunction: parseFunction}

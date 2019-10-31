const parse = require("./parse.js");
const util = require('util');
const fs = require("fs");

// Test that the given input parses to the expected output
function expect(name : string, input : string, fn : (s : any) => any, expected : object) : void {
  var s = new parse.State(input);
  let actual = fn(s);
  if (JSON.stringify(actual) == JSON.stringify(expected)) {
    console.log(`${name} ✓`);
  } else {
    console.log(`${name} ❌`);
    console.log(`expected: ${util.inspect(expected, {depth: null})}`);
    console.log(`actual: ${util.inspect(actual, {depth: null})}`);
  }
}

// Test that the given input parses without throwing any errors
function expectSuccess(name : string, input : string, fn : (s : any) => any) {
  var s = new parse.State(input);
  try {
    fn(s);
    console.log(`${name} ✓`);
  }
  catch (err) {
    console.log(`${name} ❌`);
    console.log(`Encountered error: ${err}`);
  }
}

// Strings and numbers
expect("integer", "5", (s) => s.parseExpr(), {type: "number", value: 5});
expect("string with single quotes", "'hi'", (s) => s.parseExpr(), {type: "string", value: "hi"});
expect("string with double quotes", "\"hi\"", (s) => s.parseExpr(), {type: "string", value: "hi"});
expect("string with single quote escape characters", "'\\''", (s) => s.parseExpr(), {type: "string", value: "'"});
expect("string with double quote escape characters", '"\\""', (s) => s.parseExpr(), {type: "string", value: '"'});

expect("string escape 1", '"\\""', (s) => s.parseExpr(), {type: "string", value: '"'});
expect("string escape 2", '"\'"', (s) => s.parseExpr(), {type: "string", value: "'"});
expect("string escape 3", `"\\""`, (s) => s.parseExpr(), {type: "string", value: '"'});

// Arrays
expect("empty array", "[]", (s) => s.parseExpr(), {type: "array", elements: []});
expect("array of one number", "[1]", (s) => s.parseExpr(), {type: "array", elements: [{type: "number", value: 1}]});
expect("array of one string", "['hi']", (s) => s.parseExpr(), {type: "array", elements: [{type: "string", value: "hi"}]});

// Array indexing
expect(
  "integer index",
  "a[1]",
  (s) => s.parseExpr(), 
  {
    type: 'funcall',
    object: { type: 'variable', name: 'a' },
    chain: [ { type: 'arrindex', index: { type: 'number', value: 1 } } ]
  },
);

expect(
  "string index",
  "a['foo']",
  (s) => s.parseExpr(),
  {
    type: 'funcall',
    object: { type: 'variable', name: 'a' },
    chain: [ { type: 'arrindex', index: { type: 'string', value: "foo" } } ]
  }
);

// Objects
expect("empty object", "{}", (s) => s.parseExpr(), {type: "object", elements: []});
expect("object with single quote key", "{'hi': 'there'}", (s) => s.parseExpr(), {type: "object", elements: [["hi", {type: "string", value: "there"}]]});
expect("object with double quote key", "{\"hi\": 'there'}", (s) => s.parseExpr(), {type: "object", elements: [["hi", {type: "string", value: "there"}]]});
expect("object with no quote key", "{hi: 'there'}", (s) => s.parseExpr(), {type: "object", elements: [["hi", {type: "string", value: "there"}]]});
expect(
  "object with two elements",
  "{hi: 'there', how: ['are', 'you', 5]}",
  (s) => s.parseExpr(),
  {type: "object", elements: [
    ["hi", {type: "string", value: "there"}],
    ["how", {type: "array", elements: [{type: "string", value: "are"},
                                       {type: "string", value: "you"},
                                       {type: "number", value: 5}
    ]}]
  ]}
);

// Variables
expect("a variable", "a", (s) => s.parseExpr(), {type: "variable", name: "a"});

// Other expresssion forms
expect(
  "new with variable",
  "new foo",
  (s) => s.parseExpr(),
  {type: "new", object: {type: "variable", name: "foo"}},
);
expect(
  "new with function literal",
  "new function() {}",
  (s) => s.parseExpr(),
  {type: "new", object: {type: "function", name: null, body: [], args: []}},
);

// Infix operators
expect(
  "1 === 1",
  "1 === 1",
  (s) => s.parseExpr(),
  {type: "infixop", op: "===", left: {type: "number", value: 1}, right: {type: "number", value: 1}},
);
expect(
  "1 !== 1",
  "1 !== 1",
  (s) => s.parseExpr(),
  {type: "infixop", op: "!==", left: {type: "number", value: 1}, right: {type: "number", value: 1}},
);
expect(
  "a !== (function() {})",
  "a !== (function() {})",
  (s) => s.parseExpr(),
  {type: "infixop", op: "!==", left: {type: "variable", name: "a"}, right: {type: "function", name: null, body: [], args: []}},
);
expect(
  "a += 1",
  "a += 1",
  (s) => s.parseExpr(),
  {type: "infixop", op: "+=", left: {type: "variable", name: "a"}, right: {type: "number", value: 1}},
);
expect(
  "a + b + c",
  "a + b + c",
  (s) => s.parseExpr(),
  {
    type: "infixop",
    op: "+",
    left: {type: "variable", name: "a"},
    right: {
      type: "infixop",
      op: "+",
      left: {type: "variable", name: "b"},
      right: {type: "variable", name: "c"},
    },
  },
);
expect(
  "c !== a && c !== b",
  "c !== a && c !== b",
  (s) => s.parseExpr(),
  {
    type: "infixop",
    op: "!==",
    left: {type: "variable", name: "c"},
    right: {
      type: "infixop",
      op: "&&",
      left: {type: "variable", name: "a"},
      right: {
        type: "infixop",
        op: "!==",
        left: {type: "variable", name: "c"},
        right: {type: "variable", name: "b"},
      },
    },
  },
);

// While
expect(
  `while (x === 1) { a += x; }`,
  `while (x === 1) { a += x; }`,
  (s) => s.parseStatement(),
  {
    type: "while",
    cond: {
      type: 'infixop',
      op: '===',
      left: { type: 'variable', name: 'x' },
      right: { type: 'number', value: 1 }
    },
    body: [
      {
        type: 'infixop',
        op: '+=',
        left: { type: 'variable', name: 'a' },
        right: { type: 'variable', name: 'x' }
      }
    ],
  },
);

// Functions
expect(
  "empty unnamed function",
  "function() {}",
  (s) => s.parseExpr(),
  {type: "function", name: null, body: [], args: []},
);
expect(
  "empty named function",
  "function foo() {}",
  (s) => s.parseExpr(),
  {type: "function", name: "foo", body: [], args: []},
);
expect(
  "simple function",
  "function foo(a) { return; }",
  (s) => s.parseExpr(),
  {type: "function", name: "foo", body: [{type: "return", value: null}], args: ["a"]},
);
expect(
  "complex function",
  "function foo(a, b, c) { a = 1; b.fireMissiles(); return a; }",
  (s) => s.parseExpr(),
  {
    type: "function",
    name: "foo",
    body: [
      {type: "assign", assigns: [{name: {type: "variable", name: "a"}, value: {type: "number", value: 1}}]},
      {type: "funcall", object: {type: "variable", name: "b"}, chain: [
        {type: "property", property: "fireMissiles"},
        {type: "funcall", args: []},
      ]},
      {type: "return", value: {type: "variable", name: "a"}},
    ],
    args: ["a", "b", "c"],
  },
);

// Assignment
expect(
  "a = b;",
  "a = b;",
  (s) => s.parseStatement(),
  {
    type: "assign",
    assigns: [
      {
        name: {type: "variable", name: "a"},
        value: {type: "variable", name: "b"}
      },
    ],
  },
);

// If statement
expect(
  "if (a == 1) { foo(); }",
  "if (a == 1) { foo(); }",
  (s) => s.parseStatement(),
  {
    type: "if",
    cond: {type: "infixop", op: "==", left: {type: "variable", name: "a"}, right: {type: "number", value: 1}},
    then: [
      {
        type: 'funcall',
        object: { type: 'variable', name: 'foo' },
        chain: [ { type: 'funcall', args: [] } ]
      }
    ],
    else: null
  },
);

// Constructor function
expect(
  "constructor function",
  "function State(input) {\n var _this = this; // The parse state \n}",
  (s) => s.parseExpr(),
  {
    type: "function",
    name: "State",
    body: [
      {
        type: "assign",
        assigns: [
          {
            name: {type: "variable", name: "_this"},
            value: {type: "variable", name: "this"},
          }
        ]
      },
      { type: 'comment', content: ' The parse state ' },
    ],
    args: ["input"],
  },
);

// Function call
expectSuccess(
  "foo.bar(function() { return a; })",
  "foo.bar(function() { return a; });",
  (s) => s.parseStatement(),
);

// Bare variable declaration
expect(
  "var a;",
  "var a;",
  (s) => s.parseStatement(),
  { type: "vardecl", names: [{type: "variable", name: "a"}] },
);

// try..catch
expect(
  "try...catch",
  "try { foo(); } catch(err) { bar(); }",
  (s) => s.parseStatement(),
  {
    type: "trycatch",
    try_block: [
      {
        type: "funcall",
        object: {type: "variable", name: "foo"},
        chain: [{type: "funcall", args: []}],
      }
    ],
    catch_arg: "err",
    catch_block: [
      {
        type: "funcall",
        object: {type: "variable", name: "bar"},
        chain: [{type: "funcall", args: []}],
      }
    ]
  },
);

// Throw
expect(
  "throw",
  "throw err;",
  (s) => s.parseStatement(),
  {
    type: "throw",
    value: {type: "variable", name: "err"},
  },
);

// A small example
expectSuccess(
  "a small example",
  fs.readFileSync("./sample2.js", {encoding: "utf-8"}),
  (s) => s.parseStatement(),
);

// Another small example
expectSuccess(
  "another small example",
  fs.readFileSync("./sample3.js", {encoding: "utf-8"}),
  (s) => s.parseStatement(),
);

// Another small example
expectSuccess(
  "many infix ops",
  fs.readFileSync("./sample4.js", {encoding: "utf-8"}),
  (s) => s.parseStatement(),
);

// Another small example
expectSuccess(
  "!expr",
  fs.readFileSync("./sample5.js", {encoding: "utf-8"}),
  (s) => s.parseStatement(),
);

// Another small example
expectSuccess(
  "a more complex function",
  fs.readFileSync("./sample6.js", {encoding: "utf-8"}),
  (s) => s.parseStatement(),
);

// A large example
expectSuccess(
  "a very large constructor",
  fs.readFileSync("./sample.js", {encoding: "utf-8"}),
  (s) => s.parseStatement(),
);

// The whole parser
expectSuccess(
  "parse.js",
  fs.readFileSync("./parse.js", {encoding: "utf-8"}),
  (s) => { let r = s.many(s.parseStatement); s.eof(); return r; },
);

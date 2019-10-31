function parseString() {
    var _this = this;
    var str = this.between(function () { return _this.oneOf([function () { return _this.string("\""); }, function () { return _this.string("'"); }]); }, function () { return _this.oneOf([function () { return _this.string("\""); }, function () { return _this.string("'"); }]); }, function () { return _this.satisfy(function (c) { return c !== "\"" && c !== "'"; }); });
    return { type: "string", value: str };
}

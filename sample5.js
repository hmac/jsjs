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

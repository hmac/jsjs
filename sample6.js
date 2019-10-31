function oneOf(parsers) {
    var _this = this;
    var result;
    parsers.forEach(function (parser) {
        if (result === undefined) {
            var loc_before = _this.loc;
            try {
                result = parser();
            }
            catch (err) {
                if (loc_before < _this.loc) {
                    // We have consumed input, so fail
                    throw err;
                }
                // Otherwise, continue to the next parser
            }
        }
    });
    // if the result is null, try the last parser again to get an error message
    return result || this["try"](parsers.pop());
}

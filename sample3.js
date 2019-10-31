function skipSpace() {
    while (this.peek(1) == " " || this.peek(1) == "\n") {
        this.consume(1);
    }
    return null;
}

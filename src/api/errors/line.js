module.exports = class Line {
  constructor(pathString, lineNumber) {
    this.path = pathString;
    this.line = lineNumber;
    this.isSQL = false;
  }
}
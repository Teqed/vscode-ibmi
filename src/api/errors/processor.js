const ILEError = require(`./error`);
const Expansion = require(`./expansion`);
const FileID = require(`./fileid`);
const Line = require(`./line`);

module.exports = class Processor {
  /**
   * @param {FileID} file 
   */
  constructor(file) {
    this.file = file;

    /** @type {Line[]} */
    this.sourceMap = [];

    /** @type {{[fileid: number]: number}} */
    this.addedLines = {};

    /** @type {{[fileid: number]: number}} */
    this.startingIndex = {};

    /** @type {{[file: number]: string}} */
    this.paths = {};

    /** @type {{[path: string]: ILEError[]}} */
    this.errors = {};

    this.isParent = true;
  }

  /**
   * @param {FileID|null} workingFile
   * @param {Line[]} [baseLines] 
   * @returns {Line[]} Expanded code
   */
  expand(workingFile, baseLines) {
    const file = workingFile || this.file;

    this.startingIndex[file.id] = file.startsAt;
    this.paths[file.id] = file.path;

    if (!this.addedLines[file.parent])
      this.addedLines[file.parent] = 0;

    if (baseLines) {
      this.sourceMap = baseLines;
      this.isParent = false;
    } else {
      if (this.isParent === true && file.id !== 999) {
        this.sourceMap.splice(
          file.startsAt + 1 + this.addedLines[file.parent], 
          0, 
          ...Array(file.length)
            .fill({})
            .map((x, i) => ({
              path: file.path,
              line: i + 1,
              isSQL: false
            }))
        );

        this.addedLines[file.parent] += file.length;
      }
    }

    file.declarations.forEach(declaration => {
      if (declaration instanceof Expansion) {
      // To add:
        if (declaration.range.start >= 0 && declaration.range.end >= 0) {
          const size = declaration.range.end - declaration.range.start + 1;
          const startFrom = this.startingIndex[declaration.on];
          this.sourceMap.splice(startFrom + 1 + declaration.range.start, 0, 
            ...Array(size).fill({})
              .map((x, i) => ({
                path: `EXPANSION`,
                line: i + 1,
                isSQL: true
              })
              )
          );

        } else
      
        // To remove:
        if (declaration.defined.start >= 0 && declaration.defined.end >= 0) {
          const size = declaration.defined.end - declaration.defined.start + 1;
          this.addedLines[file.parent] -= size;
          this.sourceMap.splice(file.startsAt + 1 + declaration.defined.start + 1, size);
        }
      } else
      if (declaration instanceof ILEError) {

        const realLine = this.sourceMap[declaration.linenum];
        if (realLine && realLine.isSQL === false) {
          declaration.linenum = realLine.line;

          if (!this.errors[realLine.path]) this.errors[realLine.path] = [];
          this.errors[realLine.path].push(declaration);
        }
      } else
      if (declaration instanceof FileID) {
        this.expand(declaration);
      }
    });

    return this.sourceMap;
  }
}
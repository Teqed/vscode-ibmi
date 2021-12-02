
const ILEError = require(`../error`);
const Line = require(`../line`);
const Expansion = require(`../expansion`);
const FileID = require(`../fileid`);
const {
  formatName,
  formatIFS
} = require(`../format`);
const Processor = require(`../processor`);

/**
 * Returns object of files and their errors
 * @param {string[]} lines file contents
 * @returns {{[FILE: string]: { sev: number, linenum: number, column: number, toColumn: number, text: string, code: string }[]}} Errors object
 */
module.exports = function getErrors(lines) {
  /** @type {Processor[]} */
  let processors = [];

  let pieces = [];
  let curtype = ``;
  let _FileID;

  let line;
  let tempFileID;

  /** @type {FileID} */
  let existingFile;

  /** @type {FileID} */
  let baseFile = null;

  /** @type {FileID[]} */
  let deepFiles = [];

  let currentFileIndex = 0;

  /** @type {{[id: number]: string}} */
  let truePaths = {};

  // =============================================
  // First, let's parse the evfevent content
  //
  // Processors -> files -> expansions & errors
  // =============================================

  for (let x in lines) {
    line = lines[x];

    if (line.trim() == ``) continue;
    line = line.padEnd(150);

    pieces = line.split(` `).filter(x => x !== ``);
    curtype = line.substr(0, 10).trim();
    _FileID = Number(line.substr(13, 3));
    tempFileID = _FileID;

    switch (curtype) {
    case `PROCESSOR`:
      if (baseFile) processors.push(new Processor(baseFile));
      baseFile = null;
      break;

    case `FILEID`:
      let validName = pieces[5].endsWith(`)`) ? formatName(pieces[5]) : formatIFS(pieces[5]);

      if (!truePaths[_FileID]) 
        truePaths[_FileID] = validName;

      const parent = deepFiles[deepFiles.length - 1];
      const newFile = new FileID(_FileID, parent ? parent.id : null);
      newFile.path = validName;
      newFile.startsAt = Number(pieces[3])-1;
      
      deepFiles.push(newFile);
      currentFileIndex += 1;

      break;

    case `FILEEND`:
      existingFile = deepFiles.pop();
      existingFile.length = Number(pieces[3]);
      if (deepFiles.length > 0)
        deepFiles[deepFiles.length - 1].declarations.push(existingFile);
      else
        baseFile = existingFile;
      break;

    case `EXPANSION`:
      existingFile = deepFiles[deepFiles.length - 1];

      if (existingFile) {
        const newExpansion = new Expansion();
        newExpansion.defined = {
          start: Number(pieces[3])-1,
          end: Number(pieces[4])-1
        };
        newExpansion.on = Number(pieces[5]);
        newExpansion.range = {
          start: Number(pieces[6])-1,
          end: Number(pieces[7])-1
        };
        existingFile.declarations.push(newExpansion);
      }
      break;

    case `ERROR`:
      let sev = Number(line.substr(58, 2));
      let linenum = Number(line.substr(37, 6))-1;
      let column = Number(line.substr(33, 3));
      let toColumn = Number(line.substr(44, 3));
      let text = line.substr(65).trim();
      let code = line.substr(48, 7).trim();

      existingFile = deepFiles[deepFiles.length - 1];
      if (existingFile) {
        const newError = new ILEError();
        newError.fileID = _FileID;
        newError.sev = sev;
        newError.linenum = linenum;
        newError.column = column;
        newError.toColumn = toColumn;
        newError.text = text;
        newError.code = code;
        existingFile.declarations.push(newError);
      }
      break;
    }
  }

  // EXPAND FILE TO SOURCEMAP
  // THEN HAND EXPANSIONS

  if (baseFile) processors.push(new Processor(baseFile));

  console.log(processors);

  // =============================================
  // Next, we build a source map of the code from the compiler 
  // We do this because the SQL precompiler error listing isn't useful to anyone.
  // *LVL2 on the SQL precompilers expands the copybooks into a single source file
  // Then we map each line number in the generated source to the original source (e.g. a source map)
  // =============================================

  /** @type {Line[]} */
  let generatedLines = null;

  /** @type {{[path: string]: ILEError[]}} */
  let fileErrors = {};

  let doneParent = false;

  processors.forEach(processor => {
    generatedLines = processor.expand(null, generatedLines);
    console.log(generatedLines);

    Object.keys(processor.errors).forEach(file => {
      if (fileErrors[file]) {
        fileErrors[file].push(...processor.errors[file]);
      } else {
        fileErrors[file] = processor.errors[file];
      }
    });
  });

  console.log({generatedLines, lines});

  /** @ts-ignore */
  return fileErrors;
}
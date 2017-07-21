const {promisify} = require('util');
const fs = require('fs');
const {unlink} = require('fs');
const writeFile = promisify(fs.writeFile);
const readDir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

const {execFile} = require('child_process');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
let Parser = require('xml2js').Parser;
let Builder = require('xml2js').Builder;


app.use(express.static('./public'));
app.use('/node_modules', express.static('./node_modules'));
app.use('/dist', express.static('./dist'));

app.get('/api/files', (req, res) => {
    readDir('/data')
        .then(files => {
            res.send({files, inProgress});
        });
});

app.delete('/api/files/:fileName', (req, res) => {
    unlink(`/data/${req.params.fileName}`, (err) => {
        if (err) return res.send({err});
        res.send({done: true});
    });
});

app.get('/download/:fileName', (req, res) => {
    res.download(`/data/${req.params.fileName}`);
});

app.use('/api', bodyParser.json({limit: '1024Mb'}));

function parseXML(xml) {
    return new Promise((resolve, reject) => {
        let parser = new Parser();
        parser.parseString(xml, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        })
    });
}

function buildXml(root) {
    let builder = new Builder({headless: true});
    return builder.buildObject(root);
}

async function parseChapter(xmlChapter, index, numChapters) {
    let content = xmlChapter._;
    let attr = xmlChapter.$;
    let paragraphs = await tagPos(content.split(/(?:\\r|\\n|\r|\n)+/).filter(seg => seg.length > 0).join('<br>'));
    paragraphs = paragraphs.split('<br>\n');
    paragraphs = paragraphs.map((text, ind) => ({
        $: {index: ind + 1, rindex: paragraphs.length - ind },
        _: '\n' + text
    }));
    return {
        $: {index: index + 1, rindex: numChapters - index, title: xmlChapter.$.title},
        paragraph: paragraphs
    };
}

function allWithProgress(promises, cb) {
    promises.forEach(p => {
        p.then(cb);
    });
    return Promise.all(promises);
}

function findYear(str) {
    const regex = /[0-9]{2,4}/g;
    let m;

    let bestMatch = "";
    while ((m = regex.exec(str)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        let match = m[0];
        if (match.length > bestMatch)
            bestMatch = match;
    }
    try {
        return parseInt(bestMatch)
    } catch (e) {
        return 0;
    }
}

function yearToCentury(year) {
    return Math.floor(year / 100) + "xx";
}

function yearToDecade(year) {
    return Math.floor(year / 10) + "x";
}

function createUniqueId(title, author) {
    let str = author + title;
    const regex = /[a-zA-Z]+/g;
    let m;

    let id = "";
    while ((m = regex.exec(str)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        let match = m[0];
        id += match;
    }
    return id.toLowerCase();
}

async function parseTei(name, xml) {
    // this is a Text Encoding Initiative file
    let tei = xml.TEI;
    let header = tei.teiHeader[0].fileDesc[0];
    // console.log(header);
    let titleStmt = header.titleStmt[0];
    let publicationStmt = header.publicationStmt[0];
    let sourceDesc = header.sourceDesc[0].biblStruct[0].monogr[0];
    let imprint = sourceDesc.imprint[0];
    let title = titleStmt.title.join(' ').trim();
    let author = titleStmt.author.join(' ').trim();
    let year = 0;
    let century = "0xx";
    let decade = "0x";
    try {
        let date = imprint.date.join(' ').trim();
        year = findYear(date);
        century = yearToCentury(year);
        decade = yearToDecade(year);
    } catch (e) {}
    try {
        author = sourceDesc.author.join(' ').trim();
        title = sourceDesc.title.join(' ').trim();
    } catch (e) {}
    let id = createUniqueId(title, author);
    let chapters = [];
    function walkText(obj) {
        if (Array.isArray(obj)) {
            obj.forEach(item => walkText(item));
        } else {
            for (let key of Object.keys(obj)) {
                if (key === 'chapter') {
                    chapters.push(...obj[key]);
                } else {
                    walkText(obj[key]);
                }
            }
        }
    }
    let text = tei.text;
    walkText(text);

    let done = 0;
    let total = chapters.length + 1;
    function progress() {
        done++;
        inProgress[name] = done / total;
    }
    let transformedChapters = await allWithProgress(chapters.map((chapter, ind) => parseChapter(chapter, ind, chapters.length)), progress);

    let transformed = [{
        $: {id: id, title, author, year: "" + year, century, decade},
        chapter: transformedChapters
    }];
    return transformed;
}

async function parseLinearChapter(chapter, index, numChapters) {
    let tagged = await tagPos(chapter.paragraphs.join('<br>'));
    paragraphs = tagged.split('<br>\n');
    paragraphs = paragraphs.map((text, ind) => ({
        $: {index: ind + 1, rindex: paragraphs.length - ind },
        _: '\n' + text
    }));
    return {
        $: {index: index + 1, rindex: numChapters - index, title: chapter.title},
        paragraph: paragraphs
    };
}

const TOO_SHORT_PARAGRAPH_THRESHOLD = 30;
const LONG_ENOUGH_PARAGRAPH_THRESHOLD = 200;
function paragraphSanityCheck(rawParagraphs) {
    let paragraphs = rawParagraphs;
    let avgWords = paragraphs.reduce((sum, l) => sum + l.split(' ').length, 0) / paragraphs.length;
    let avgChars = paragraphs.reduce((sum, l) => sum + l.length, 0) / paragraphs.length;
    if (avgWords < TOO_SHORT_PARAGRAPH_THRESHOLD) {
        paragraphs = [];
        let currentP = null;
        let words = 0;
        rawParagraphs.forEach(line => {
            if (currentP === null) {
                currentP = line;
                words = line.split(' ').length;
            } else {
                currentP += line;
                words += line.split(' ').length;
                if ((words > TOO_SHORT_PARAGRAPH_THRESHOLD && line.length < avgChars / 2) ||
                    (words > LONG_ENOUGH_PARAGRAPH_THRESHOLD)) {
                    paragraphs.push(currentP);
                    currentP = null;
                }
            }
        });
        if (currentP !== null)
            paragraphs.push(currentP);
    }
    return paragraphs;
}


async function parseLinear(name, content) {
    let lines = content
        .split(/(?:\\r|\\n|\r|\n)+/)
        .map(str => str.trim())
        .filter(seg => seg.length > 0)
    let chapters = [];
    let currentChapter = null;
    lines.forEach(c => {
        if (c.startsWith('#!')) {
            let title = c.slice(2).trim();
            currentChapter = {
                title,
                paragraphs: []
            };
            chapters.push(currentChapter);
        } else if (currentChapter !== null) {
            currentChapter.paragraphs.push(c);
        }
    }, []);
    chapters.forEach(chapter => {
        chapter.paragraphs = paragraphSanityCheck(chapter.paragraphs);
    });
    let done = 0;
    let total = chapters.length + 1;
    function progress() {
        done++;
        inProgress[name] = done / total;
    }
    let transformedChapters = await allWithProgress(chapters.map((chapter, ind) => parseLinearChapter(chapter, ind, chapters.length)), progress);

    let transformed = [{
        $: {
            id: '[id Ex.: austinpark]', 
            title: '[title .: Mansfield Park]', 
            author: '[author Ex.: Jane Austin]', 
            authorid: '[authorid Ex.: austin]', 
            year: '[year Ex.: 1893]', 
            century: '[century Ex.: 19xx]', 
            decade: '[decade Ex.: 198x]'
        },
        chapter: transformedChapters
    }];
    return transformed;
}

async function parseTexts(name, content) {
    if (content.indexOf('#!') >= 0) {
        return await parseLinear(name, content);
    } else {
        let xml = await parseXML(content);
        if ('TEI' in xml) {
            return await parseTei(name, content);
        } else if ('corpus' in xml) {
            return xml.corpus.text;
        } else {
            throw "Unknown format";
        }
    }
    
    
}

const inProgress = {};

async function createCorpus(name, content) {
    inProgress[name] = 0;

    try {
        let texts = await parseTexts(name, content);
        let corpus = {
            corpus: {
                text: texts
            }
        };
        let corpusXml = buildXml(corpus);
        await writeFile(`/data/${name}`, corpusXml, 'utf8');
    } catch (e) {
        console.error(e);
    } finally {
        delete inProgress[name];
    }
} 

app.post('/api/transform', async function(req, res) {
    let {files} = req.body;
    files.forEach(({name, content}) => {
        createCorpus(name, content)
            .catch(console.error);
    });
    
    res.send({wip: true});
    
})

async function mergeTexts(name, files) {
    let total = files.length + 1;
    let done = 0;
    let texts = [];
    inProgress[name] = 0;
    for (let file of files) {
        let data = await readFile(`/data/${file}`, 'utf8');
        let xml = await parseXML(data);
        done++;
        inProgress[name]++;
        texts.push(...xml.corpus.text);
    }
    let corpus = {
        corpus: {
            text: texts
        }
    };
    let mergedXml = buildXml(corpus);
    await writeFile(`/data/${name}`, mergedXml, 'utf8');
    delete inProgress[name];
}

app.post('/api/merge', async function(req, res) {
    let {files, mergedName} = req.body;
    mergeTexts(mergedName, files)
        .catch(console.error);
    res.send({wip: true});
    
})


app.listen(8080, () => {
    console.log('server is listening on port 8080');
});


const treeTaggerExec = '/tree-tagger/cmd/tree-tagger-english'


let runningTags = 0;
function tagPos(data) {
    return new Promise((resolve, reject) => {
        let fileName = `/tmp/${Math.floor(Math.random() * 10000000).toString(16)}`
        writeFile(fileName, data, 'utf8').then(result => {
            function tryTag() {
                if (runningTags > 4) {
                    setTimeout(tryTag, 100);
                    return;
                }
                runningTags++;
                let child = execFile(treeTaggerExec, [fileName], {encoding: 'utf8', cwd: '/tree-tagger', maxBuffer: 10 * 1024 * 1024}, (error, stdOut, stdErr) => {
                    runningTags--;
                    if (error) {
                        reject(error);
                    } else {
                        resolve(stdOut);
                    }
                    unlink(fileName, (err) => {
                        if (err) console.error(err);
                    });
                });
            }
            tryTag();
        });
        
    });
}
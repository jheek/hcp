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
        $: {index: ind + 1, rindex: ind - paragraphs.length },
        _: text
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

async function parseTexts(name, content) {
    let xml = await parseXML(content);
    if ('TEI' in xml) {
        // this is a Text Encoding Initiative file
        let tei = xml.TEI;
        let header = tei.teiHeader[0].fileDesc[0];
        let titleStmt = header.titleStmt[0];
        let publicationStmt = header.publicationStmt[0];
        let title = titleStmt.title.join(' ').trim();
        let author = titleStmt.author.join(' ').trim();

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
            $: {id: title.split(' ').join('-'), title, author},
            chapter: transformedChapters
        }];
        return transformed;
    } else if ('corpus' in xml) {
        return xml.corpus.text;
    } else {
        throw "Unknown format";
    }
}

const inProgress = {};

async function createCorpus(name, content) {
    inProgress[name] = 0;

    let texts = await parseTexts(name, content);

    let corpus = {
        corpus: {
            text: texts
        }
    };
    let corpusXml = buildXml(corpus);
    await writeFile(`/data/${name}`, corpusXml, 'utf8');

    delete inProgress[name];
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
                let child = execFile(treeTaggerExec, [fileName], {encoding: 'utf8', cwd: '/tree-tagger'}, (error, stdOut, stdErr) => {
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

const express = require('express');
const app = express();

app.use(express.static('./public'));
app.use('/node_modules', express.static('./node_modules'));
app.use('/dist', express.static('./dist'));

app.listen(8080, () => {
    console.log('server is listening on port 8080');
});

// let Parser = require('xml2js').Parser;
// let parser = new Parser();

// fs.readFile(file, 'utf8', (err, content) => {
//     if (err) {
//         console.error('Failed to read file');
//         return;
//     }
//     parser.parseString(content, (err, xml) => {
//         console.log(xml);
//         console.log(xml.TEI.text);
//         console.log(xml.TEI.text[0].div1[0].chapter[0]);
//         let chapters = xml.TEI.text[0].div1[0].chapter;
//         let contents = chapters.map(chapter => ({$: chapter.$}))
//         console.log(contents);
//     });
// });




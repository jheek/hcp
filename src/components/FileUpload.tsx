import * as React from 'react';
import Dropzone = require('react-dropzone');
import RaisedButton from 'material-ui/RaisedButton';
import {List, ListItem} from 'material-ui/List'; 

import ActionDelete from 'material-ui/svg-icons/action/delete';

export interface UploadedFile {
    name: string;
    content: string;
}

interface FileUploadProps {
    onFiles: (files: UploadedFile[]) => void;
}

interface FileUploadState {
    reading: number;
    files: UploadedFile[];
}

export class FileUpload extends React.Component<FileUploadProps, FileUploadState> {

    constructor(props: FileUploadProps) {
        super(props);
        this.state = {
            reading: 0,
            files: []
        };
    }

    onDrop = (files: File[]) => {
        this.setState(state => ({...state, reading: state.reading + 1}));
        files.forEach(file => {
            let reader: FileReader = new FileReader();
            reader.addEventListener("loadend", () => {
                let content: string = reader.result;
                let newFile: UploadedFile = {
                    name: file.name,
                    content
                };
                this.setState(state => ({...state, reading: state.reading - 1, files: [...state.files, newFile]}));
            });
            reader.readAsText(file, 'utf8');
        });
    };

    handleSubmitClick = () => {
        this.props.onFiles(this.state.files);
        this.setState(state => ({...state, files: []}))
    };

    handleRemoveFile(file: UploadedFile): () => void {
        return () => {
            this.setState(state => ({...state, files: state.files.filter(f => f !== file)}))
        }
    }

    render() {
        let {reading, files} = this.state;
        return (
            <div>
                <Dropzone onDrop={this.onDrop}>
                    <p>Try dropping some TEI files here, or click to select files to upload.</p>
                </Dropzone>
                <List style={{maxWidth: '50em'}}>
                    {files.map(file => (
                        <ListItem key={file.name} primaryText={file.name} rightIcon={<ActionDelete onClick={this.handleRemoveFile(file)}/>}  />
                    ))}
                </List>
                {reading > 0 && <p>Reading {reading} files...</p>}
                <RaisedButton label="Submit" disabled={reading > 0} primary={true} onClick={this.handleSubmitClick} />
            </div>
        );
    }
}
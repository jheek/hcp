import * as React from 'react';
import RaisedButton from 'material-ui/RaisedButton';
import {List, ListItem} from 'material-ui/List'; 
import Subheader from 'material-ui/Subheader';
import Divider from 'material-ui/Divider';
import LinearProgress from 'material-ui/LinearProgress';
import TextField from 'material-ui/TextField';
import ActionDelete from 'material-ui/svg-icons/action/delete';

import * as fetch from 'isomorphic-fetch';
import Checkbox from 'material-ui/Checkbox';

interface FilesListProps {
    files: Files;
}

interface FilesListState {
    checked: string[];
    mergedName: string;
}

export interface Files {
    files: string[];
    inProgress: {[name: string]: number};
}

export class FilesList extends React.Component<FilesListProps, FilesListState> {

    constructor(props: FilesListProps) {
        super(props);
        this.state = {
            checked: [],
            mergedName: ""
        };
    }

    handleRemoveFile(name: string): () => void {
        return () => {
            this.setState(state => ({...state, checked: state.checked.filter(c => c !== name)}))
            fetch(`/api/files/${name}`, {method: 'DELETE'})
                .then(res => res.text())
                .then(console.log)
                .catch(console.error);
        }
    }

    handleToggle(name: string): () => void {
        let selected 
        return () => {
            this.setState((state: FilesListState) => {
                if (state.checked.some(c => c === name)) {
                    return {...state, checked: state.checked.filter(c => c !== name)};
                } else {
                    return {...state, checked: [...state.checked, name]};
                }
            })
        }
    }

    handleMergeClick = () => {
        let {checked, mergedName} = this.state;
        fetch('/api/merge', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({mergedName, files: checked})
        }).then(res => res.json())
          .then(json => console.log(json))
          .catch(err => console.error(err));
        this.setState(state => ({...state, checked: []}));
    }

    render() {
        let {files, inProgress} = this.props.files;
        let {checked, mergedName} = this.state;
        return (
            <div>
                <List style={{maxWidth: '50em'}}>
                    <Subheader>In progress</Subheader>
                    {Object.keys(inProgress).map(name => (
                        <ListItem key={name} primaryText={name} secondaryText={<LinearProgress mode="determinate" value={inProgress[name] * 100} />} />
                    ))}
                    <Divider />
                </List>
                <List style={{maxWidth: '50em'}}>
                    <Subheader>Click to download</Subheader>
                    {files.map(name => (
                        <ListItem 
                            key={name} 
                            primaryText={<a href={`/download/${name}`} download>{name}</a>}
                            leftCheckbox={<Checkbox checked={checked.some(c => c === name)} onCheck={this.handleToggle(name)}/>}
                            rightIcon={<ActionDelete onClick={this.handleRemoveFile(name)}/>} />
                    ))}
                </List>
                <TextField floatingLabelText="Merged name" value={mergedName} onChange={(ev, val) => this.setState(state => ({...state, mergedName: val}))}/>
                <RaisedButton label="Merge selected" disabled={checked.length === 0 || mergedName.length === 0} primary={true} onClick={this.handleMergeClick} />
            </div>
        );
    }
}
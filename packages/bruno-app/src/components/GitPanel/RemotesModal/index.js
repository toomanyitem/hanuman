import React, { useState } from 'react';
import { IconTrash } from '@tabler/icons';
import Modal from 'components/Modal';
import Portal from 'components/Portal';
import ActionIcon from 'ui/ActionIcon';
import Button from 'ui/Button';
import TextInput from 'ui/TextInput';

const RemoteRow = ({ remote, busyAction, run }) => {
  const [url, setUrl] = useState(remote.url);
  return (
    <div className="flex items-end gap-2" data-testid="git-remote-item" data-remote={remote.name}>
      <TextInput className="flex-1" label={remote.name} value={url} onChange={(event) => setUrl(event.target.value)} data-testid="git-remote-url" />
      <Button
        size="sm"
        variant="ghost"
        disabled={!url.trim() || url === remote.url}
        loading={busyAction === 'set-remote-url'}
        onClick={() => run('set-remote-url', { name: remote.name, url }, { successMessage: `Updated ${remote.name}` })}
        data-testid="git-remote-save"
      >
        Save
      </Button>
      <ActionIcon label={`Remove ${remote.name}`} onClick={() => run('remove-remote', { name: remote.name })} data-testid="git-remote-remove">
        <IconTrash size={14} strokeWidth={1.5} />
      </ActionIcon>
    </div>
  );
};

const RemotesModal = ({ remotes, busyAction, run, onClose }) => {
  const [name, setName] = useState(remotes.length ? '' : 'origin');
  const [url, setUrl] = useState('');

  const addRemote = async () => {
    const { ok } = await run('add-remote', { name: name.trim(), url: url.trim() }, { successMessage: `Added ${name.trim()}` });
    if (ok) {
      setName('');
      setUrl('');
    }
  };

  return (
    <Portal>
      <Modal size="md" title="Remotes" hideFooter handleCancel={onClose} dataTestId="git-remotes-modal">
        <div className="flex flex-col gap-4">
          {remotes.map((remote) => (
            <RemoteRow key={`${remote.name}:${remote.url}`} remote={remote} busyAction={busyAction} run={run} />
          ))}
          <div className="text-xs font-semibold uppercase opacity-70">Add a remote</div>
          <div className="flex items-end gap-2">
            <TextInput label="Name" value={name} onChange={(event) => setName(event.target.value)} data-testid="git-remote-add-name" />
            <TextInput
              className="flex-1"
              label="URL"
              placeholder="https://github.com/team/collection.git or git@github.com:team/collection.git"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              data-testid="git-remote-add-url"
            />
            <Button disabled={!name.trim() || !url.trim()} loading={busyAction === 'add-remote'} onClick={addRemote} data-testid="git-remote-add">
              Add
            </Button>
          </div>
          <div className="text-xs opacity-70">
            HTTPS remotes use the access token saved for their host, or your Git credential helper. SSH remotes use your SSH agent.
          </div>
        </div>
      </Modal>
    </Portal>
  );
};

export default RemotesModal;

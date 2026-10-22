import React, { useEffect, useState } from 'react';
import { IconTrash } from '@tabler/icons';
import toast from 'react-hot-toast';
import Modal from 'components/Modal';
import Portal from 'components/Portal';
import ActionIcon from 'ui/ActionIcon';
import Button from 'ui/Button';
import TextInput from 'ui/TextInput';
import { formatIpcError } from 'utils/common/error';
import { invokeGit } from '../useGitPanel';

const CredentialsModal = ({ onClose }) => {
  const [credentials, setCredentials] = useState([]);
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState(null);

  const call = async (action, args) => {
    setError(null);
    try {
      setCredentials(await invokeGit(action, args));
      return true;
    } catch (err) {
      setError(formatIpcError(err) || 'Could not update access tokens');
      return false;
    }
  };

  useEffect(() => {
    call('credentials');
  }, []);

  const save = async () => {
    if (await call('set-credential', { host, username, token })) {
      toast.success(`Saved the token for ${host.trim().toLowerCase()}`);
      setHost('');
      setUsername('');
      setToken('');
    }
  };

  return (
    <Portal>
      <Modal size="md" title="Access tokens" hideFooter handleCancel={onClose} dataTestId="git-tokens-modal">
        <div className="flex flex-col gap-4">
          <div className="text-xs opacity-70">
            A token is used for HTTPS remotes on its host when you fetch, pull or push. It is encrypted on this computer and is
            never written to the collection or to Git config.
          </div>
          {credentials.map((credential) => (
            <div key={credential.host} className="flex items-center gap-2 text-sm" data-testid="git-token-item" data-host={credential.host}>
              <span className="flex-1">{credential.host}</span>
              <span className="opacity-70">{credential.username}</span>
              <ActionIcon label={`Remove the token for ${credential.host}`} onClick={() => call('remove-credential', { host: credential.host })} data-testid="git-token-remove">
                <IconTrash size={14} strokeWidth={1.5} />
              </ActionIcon>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            <TextInput label="Host" placeholder="github.com" value={host} onChange={(event) => setHost(event.target.value)} data-testid="git-token-host" />
            <TextInput label="Username" placeholder="your username" value={username} onChange={(event) => setUsername(event.target.value)} data-testid="git-token-username" />
            <TextInput label="Token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" data-testid="git-token-value" />
          </div>
          {error && <div className="text-sm" data-testid="git-token-error">{error}</div>}
          <div className="flex justify-end">
            <Button disabled={!host.trim() || !username.trim() || !token.trim()} onClick={save} data-testid="git-token-save">
              Save token
            </Button>
          </div>
        </div>
      </Modal>
    </Portal>
  );
};

export default CredentialsModal;

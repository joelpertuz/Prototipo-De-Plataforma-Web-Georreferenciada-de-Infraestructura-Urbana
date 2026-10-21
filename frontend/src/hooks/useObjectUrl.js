import { useEffect, useState } from 'react';

export function useObjectUrl(file) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

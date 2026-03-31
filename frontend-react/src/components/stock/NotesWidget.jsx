import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { get, put } from '../../api/client';
import { useAppStore } from '../../stores/appStore';

export default function NotesWidget({ symbol }) {
  const [content, setContent] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const editorRef = useRef(null);
  const toast = useAppStore(s => s.addToast);

  const { data } = useQuery({
    queryKey: ['notes', symbol],
    queryFn: () => get(`/api/stock/${symbol}/notes`),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (data?.content != null) setContent(data.content);
  }, [data]);

  // Try to load EasyMDE dynamically
  useEffect(() => {
    let mde = null;
    const init = async () => {
      try {
        const EasyMDE = (await import('easymde')).default;
        await import('easymde/dist/easymde.min.css');
        if (editorRef.current && !editorRef.current._easymde) {
          mde = new EasyMDE({
            element: editorRef.current,
            initialValue: content,
            spellChecker: false,
            status: false,
            toolbar: ['bold', 'italic', 'heading', '|', 'unordered-list', 'ordered-list', '|', 'link', 'code', '|', 'preview', 'side-by-side', 'guide'],
          });
          mde.codemirror.on('change', () => setContent(mde.value()));
          editorRef.current._easymde = mde;
        }
      } catch {
        // EasyMDE not available, fall back to textarea
      }
    };
    init();
    return () => {
      if (mde) { mde.toTextArea(); mde = null; }
    };
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: () => put(`/api/stock/${symbol}/notes`, { content }),
    onSuccess: () => {
      setLastSaved(new Date().toLocaleTimeString());
      toast('Notes saved', 'success');
    },
    onError: (err) => toast(err.message, 'error'),
  });

  return (
    <div>
      <textarea
        ref={editorRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        style={{ width: '100%', minHeight: 150, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, padding: 8, fontFamily: 'inherit', fontSize: '0.85rem', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Notes'}
        </button>
        {lastSaved && <span className="text-muted" style={{ fontSize: '0.75rem' }}>Last saved: {lastSaved}</span>}
      </div>
    </div>
  );
}

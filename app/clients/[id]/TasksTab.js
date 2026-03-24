'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, CheckCircle, Save, Send } from 'lucide-react';
import { TASK_STATUS_COLORS, TASK_STATUSES, TASK_PRIORITIES, PRIORITY_COLORS } from '@/lib/constants';
import { Empty } from './shared';

function TasksTab({ tasks, clientId, refreshTasks }) {
  const supabase = createClient();
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', status: 'Not Started', priority: 'Medium', due_date: '', assigned_to: '',
  });
  const [saving, setSaving] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [filter, setFilter] = useState('open');
  const [deleting, setDeleting] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('team_members').select('*').eq('is_active', true).order('first_name');
      setTeamMembers(data || []);
    }
    load();
  }, []);

  const loadComments = async (taskId) => {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  const openTask = async (task) => {
    if (expandedTask?.id === task.id) { setExpandedTask(null); setEditForm(null); return; }
    setExpandedTask(task);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'Not Started',
      priority: task.priority || 'Medium',
      due_date: task.due_date || '',
      assigned_to: task.assigned_to || '',
    });
    setNewComment('');
    await loadComments(task.id);
  };

  const markDone = async (task, e) => {
    e.stopPropagation();
    const isDone = task.status === 'Done';
    const updates = isDone
      ? { status: 'Not Started', completed_at: null }
      : { status: 'Done', completed_at: new Date().toISOString() };
    const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
    if (error) { console.error('markDone error:', error); setSaveMsg('Error: ' + error.message); setTimeout(() => setSaveMsg(''), 5000); return; }
    if (expandedTask?.id === task.id) {
      setExpandedTask({ ...task, ...updates });
      setEditForm(f => f ? { ...f, status: updates.status } : f);
    }
    await refreshTasks();
  };

  const handleEditSave = async () => {
    if (!editForm || !expandedTask) return;
    setEditSaving(true);
    setSaveMsg('');
    const updates = {
      title: editForm.title.trim() || expandedTask.title,
      description: editForm.description || null,
      status: editForm.status,
      priority: editForm.priority,
      due_date: editForm.due_date || null,
      assigned_to: editForm.assigned_to || null,
    };
    if (editForm.status === 'Done' && expandedTask.status !== 'Done') {
      updates.completed_at = new Date().toISOString();
    }
    if (editForm.status !== 'Done' && expandedTask.status === 'Done') {
      updates.completed_at = null;
    }
    const { error } = await supabase.from('tasks').update(updates).eq('id', expandedTask.id);
    setEditSaving(false);
    if (error) {
      console.error('Task save error:', error);
      setSaveMsg('Error: ' + (error.message || 'Failed to save'));
      setTimeout(() => setSaveMsg(''), 5000);
      return;
    }
    // Auto-switch filter if status moved task out of current view
    const newStatus = editForm.status;
    if (newStatus !== expandedTask.status) {
      if (newStatus === 'Done') setFilter('done');
      else if (newStatus === 'Archived') setFilter('archived');
      else if (newStatus === 'Snoozed') setFilter('snoozed');
      else if (['Not Started', 'In Progress', 'Pending Client Approval'].includes(newStatus)) setFilter('open');
      setSaveMsg(`Task moved to ${newStatus}`);
      setTimeout(() => setSaveMsg(''), 3000);
      // Collapse the task panel when status changes
      setExpandedTask(null);
      setEditForm(null);
    } else {
      setSaveMsg('Changes saved');
      setTimeout(() => setSaveMsg(''), 2000);
      setExpandedTask({ ...expandedTask, ...updates });
    }
    await refreshTasks();
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !expandedTask) return;
    setCommentSaving(true);
    await supabase.from('task_comments').insert({
      task_id: expandedTask.id,
      author: 'Tim',
      content: newComment.trim(),
    });
    setNewComment('');
    setCommentSaving(false);
    await loadComments(expandedTask.id);
  };

  const handleDeleteTask = async (task, e) => {
    e.stopPropagation();
    setDeleting(task.id);
    await supabase.from('tasks').delete().eq('id', task.id);
    setDeleting(null);
    if (expandedTask?.id === task.id) { setExpandedTask(null); setEditForm(null); }
    refreshTasks();
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await supabase.from('tasks').insert({
      client_id: clientId,
      title: form.title.trim(),
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
    });
    setSaving(false);
    setForm({ title: '', description: '', status: 'Not Started', priority: 'Medium', due_date: '', assigned_to: '' });
    setShowAddForm(false);
    refreshTasks();
  };

  const getMemberName = (id) => {
    if (!id) return 'Unassigned';
    const m = teamMembers.find(t => t.id === id);
    return m ? `${m.first_name} ${m.last_name}` : 'Unknown';
  };

  const tInputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
  };
  const tLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'open') return !['Done', 'Archived', 'Snoozed'].includes(t.status);
    if (filter === 'done') return t.status === 'Done';
    if (filter === 'archived') return t.status === 'Archived';
    if (filter === 'snoozed') return t.status === 'Snoozed';
    return true;
  });

  const isOverdue = (t) => t.due_date && t.status !== 'Done' && new Date(t.due_date) < new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header: filter + add */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[{ key: 'open', label: 'Open' }, { key: 'done', label: 'Done' }, { key: 'snoozed', label: 'Snoozed' }, { key: 'archived', label: 'Archived' }, { key: 'all', label: 'All' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === f.key ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: filter === f.key ? 'white' : 'var(--text-secondary)',
              border: filter === f.key ? 'none' : '1px solid var(--border)',
            }}>{f.label}</button>
          ))}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 8 }}>
            {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        {saveMsg && (
          <span style={{ fontSize: 12, fontWeight: 600, color: saveMsg.startsWith('Error') ? '#ef4444' : '#10b981', padding: '4px 10px', background: saveMsg.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: 6 }}>
            {saveMsg.startsWith('Error') ? '✗' : '✓'} {saveMsg}
          </span>
        )}
        <button onClick={() => setShowAddForm(!showAddForm)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
        }}>
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleSaveTask} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={tLabelStyle}>Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Task title" style={tInputStyle} />
            </div>
            <div>
              <label style={tLabelStyle}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={tInputStyle}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={tLabelStyle}>Assign To</label>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={tInputStyle}>
                <option value="">— Unassigned —</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div>
              <label style={tLabelStyle}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={tInputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={tLabelStyle}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional description" style={{ ...tInputStyle, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Saving...' : 'Save Task'}</button>
            <button type="button" onClick={() => setShowAddForm(false)} style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 && !showAddForm ? (
        <Empty msg={filter === 'done' ? 'No completed tasks.' : 'No open tasks. Add one to get started.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredTasks.map(task => {
            const isExp = expandedTask?.id === task.id;
            const isDone = task.status === 'Done';
            const od = isOverdue(task);
            return (
              <div key={task.id} style={{
                background: 'var(--bg-card)',
                border: `1px solid ${isExp ? 'var(--accent)' : od ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                borderRadius: 10, overflow: 'hidden',
              }}>
                {/* Task Row */}
                <div
                  onClick={() => openTask(task)}
                  style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    opacity: isDone ? 0.6 : 1,
                  }}
                >
                  {/* Complete checkbox */}
                  <button
                    onClick={(e) => markDone(task, e)}
                    style={{
                      width: 22, height: 22, borderRadius: 6, border: `2px solid ${isDone ? '#10b981' : 'var(--border)'}`,
                      background: isDone ? '#10b981' : 'transparent', cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    {isDone && <CheckCircle size={14} style={{ color: 'white' }} />}
                  </button>

                  {/* Title + description */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{task.title}</div>
                    {task.description && !isExp && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.description}
                      </div>
                    )}
                  </div>

                  {/* Badges */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                    background: `${PRIORITY_COLORS[task.priority] || '#64748b'}15`,
                    color: PRIORITY_COLORS[task.priority] || '#64748b',
                  }}>{task.priority}</span>

                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                    background: `${TASK_STATUS_COLORS[task.status] || '#64748b'}15`,
                    color: TASK_STATUS_COLORS[task.status] || '#64748b',
                  }}>{task.status}</span>

                  {task.due_date && (
                    <span style={{
                      fontSize: 11, color: od ? '#ef4444' : 'var(--text-muted)', fontWeight: od ? 600 : 400,
                    }}>
                      {od && '! '}{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}

                  <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getMemberName(task.assigned_to)}
                  </span>
                </div>

                {/* Expanded Detail Panel */}
                {isExp && editForm && (
                  <div style={{
                    borderTop: '1px solid var(--border)', padding: 20, background: 'var(--bg-secondary)',
                    display: 'flex', flexDirection: 'column', gap: 16,
                  }}>
                    {/* Editable fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={tLabelStyle}>Title</label>
                        <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={tInputStyle} />
                      </div>
                      <div>
                        <label style={tLabelStyle}>Status</label>
                        <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={tInputStyle}>
                          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={tLabelStyle}>Priority</label>
                        <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} style={tInputStyle}>
                          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={tLabelStyle}>Assigned To</label>
                        <select value={editForm.assigned_to} onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))} style={tInputStyle}>
                          <option value="">— Unassigned —</option>
                          {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={tLabelStyle}>Due Date</label>
                        <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} style={tInputStyle} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={tLabelStyle}>Description</label>
                        <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Add a description..." style={{ ...tInputStyle, resize: 'vertical' }} />
                      </div>
                    </div>

                    {/* Save + Delete row */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                      <button onClick={(e) => handleDeleteTask(task, e)} disabled={deleting === task.id} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                      }}>
                        <Trash2 size={13} />{deleting === task.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button onClick={handleEditSave} disabled={editSaving} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'var(--accent)', color: 'white', border: 'none', cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1,
                      }}>
                        <Save size={13} />{editSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>

                    {/* Comments */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                        Comments ({comments.length})
                      </div>

                      {comments.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                          {comments.map(c => (
                            <div key={c.id} style={{
                              padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.author}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                          placeholder="Add a comment... (Enter to send)"
                          style={{ ...tInputStyle, flex: 1 }}
                        />
                        <button onClick={handleAddComment} disabled={commentSaving || !newComment.trim()} style={{
                          padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                          background: 'var(--accent)', color: 'white', border: 'none',
                          cursor: commentSaving || !newComment.trim() ? 'not-allowed' : 'pointer',
                          opacity: commentSaving || !newComment.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
                        }}>
                          <Send size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                      {task.completed_at && <span>Completed: {new Date(task.completed_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TasksTab;

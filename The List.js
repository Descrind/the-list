document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = 'https://your-supabase-url.supabase.co';
    const supabaseKey = 'your-public-api-key';
    const supabase = supabase.createClient(supabaseUrl, supabaseKey);

    const uniqueTags = new Set();

    if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
            if (permission !== 'granted') {
                alert('Please enable desktop notifications to receive reminders.');
            }
        });
    }

    function updateTagSuggestions() {
        const tagListElement = document.getElementById('tag-list');
        tagListElement.innerHTML = ''; 
        uniqueTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            tagListElement.appendChild(option);
        });
    }

    function addNoteToDOM(title, content, tags = [], priority = false) {
        const notesList = document.getElementById('notes');
        const noteItem = document.createElement('li');
        noteItem.classList.add('note-item');
        if (priority) noteItem.classList.add('high-priority');

        const noteHeader = document.createElement('div');
        noteHeader.classList.add('note-header');
        noteHeader.innerHTML = `<h3>${title}</h3>`;

        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-note-btn');
        deleteButton.textContent = 'X';

        const editButton = document.createElement('button');
        editButton.classList.add('edit-note-btn');
        editButton.textContent = '✏️';

        const priorityButton = document.createElement('button');
        priorityButton.classList.add('priority-btn');
        priorityButton.textContent = '⭐';

        const noteBody = document.createElement('p');
        noteBody.classList.add('note-body');
        noteBody.textContent = content;

        const tagsElement = document.createElement('div');
        tagsElement.classList.add('note-tags');
        tags.forEach(tag => {
            const capitalizedTag = tag.trim().charAt(0).toUpperCase() + tag.trim().slice(1).toLowerCase();
            uniqueTags.add(capitalizedTag);
            const tagElement = document.createElement('span');
            tagElement.classList.add('tag');
            tagElement.textContent = capitalizedTag;
            tagsElement.appendChild(tagElement);
        });

        noteHeader.appendChild(editButton);
        noteHeader.appendChild(priorityButton);
        noteHeader.appendChild(deleteButton);
        noteItem.appendChild(noteHeader);
        noteItem.appendChild(noteBody);
        noteItem.appendChild(tagsElement);

        if (priority) {
            notesList.insertBefore(noteItem, notesList.firstChild);
        } else {
            notesList.appendChild(noteItem);
        }

        editButton.addEventListener('click', function() {
            noteHeader.querySelector('h3').contentEditable = true;
            noteBody.contentEditable = true;
            noteHeader.querySelector('h3').focus();
        });

        priorityButton.addEventListener('click', function() {
            noteItem.classList.toggle('high-priority');
            if (noteItem.classList.contains('high-priority')) {
                notesList.insertBefore(noteItem, notesList.firstChild);
            } else {
                notesList.appendChild(noteItem);
            }
            saveNotesToDatabase();
        });

        deleteButton.addEventListener('click', async function() {
            notesList.removeChild(noteItem);
            tags.forEach(tag => uniqueTags.delete(tag.trim()));
            await removeReminder(title);
            await deleteNoteFromDatabase(title);
            updateTagSuggestions();
        });

        saveNotesToDatabase();
        updateTagSuggestions();
    }

    document.getElementById('add-note-btn').addEventListener('click', async function() {
        const title = document.getElementById('note-title').value;
        const content = document.getElementById('note-content').value;
        const tags = document.getElementById('note-tags').value.split(',').filter(tag => tag.trim() !== "");
        const reminderTime = document.getElementById('note-reminder').value;

        if (title) {
            addNoteToDOM(title, content, tags);
            document.getElementById('note-title').value = '';
            document.getElementById('note-content').value = '';
            document.getElementById('note-tags').value = '';
            document.getElementById('note-reminder').value = '';

            if (reminderTime) {
                await saveReminder(reminderTime, title);
                setReminder(reminderTime, title);
            }
        } else {
            alert('Please enter a title for your note.');
        }
    });

    async function saveNotesToDatabase() {
        const notes = [];
        document.querySelectorAll('.note-item').forEach(note => {
            const title = note.querySelector('h3').textContent;
            const content = note.querySelector('.note-body').textContent;
            const tags = Array.from(note.querySelectorAll('.tag')).map(tag => tag.textContent);
            const priority = note.classList.contains('high-priority');
            notes.push({ title, content, tags, priority });
        });

        const { data, error } = await supabase
            .from('notes')
            .insert(notes, { onConflict: ['title'], returning: 'minimal' });

        if (error) {
            console.error('Error saving notes to database:', error);
        } else {
            console.log('Notes saved to database.');
        }
    }

    async function loadNotesFromDatabase() {
        const { data: notes, error } = await supabase
            .from('notes')
            .select('*');

        if (error) {
            console.error('Error loading notes from database:', error);
        } else {
            notes.forEach(note => {
                addNoteToDOM(note.title, note.content, note.tags, note.priority);
            });
        }
    }

    async function deleteNoteFromDatabase(title) {
        const { data, error } = await supabase
            .from('notes')
            .delete()
            .eq('title', title);

        if (error) {
            console.error('Error deleting note from database:', error);
        } else {
            console.log('Note deleted from database.');
        }
    }

    async function saveReminder(dateTime, noteTitle) {
        const { data, error } = await supabase
            .from('reminders')
            .insert([{ dateTime, noteTitle }]);

        if (error) {
            console.error('Error saving reminder:', error);
        } else {
            console.log('Reminder saved:', data);
        }
    }

    async function removeReminder(noteTitle) {
        const { data, error } = await supabase
            .from('reminders')
            .delete()
            .eq('noteTitle', noteTitle);

        if (error) {
            console.error('Error removing reminder:', error);
        } else {
            console.log('Reminder removed:', data);
        }
    }

    function setReminder(dateTime, noteTitle) {
        const now = new Date().getTime();
        const reminderTime = new Date(dateTime).getTime();
        const timeDiff = reminderTime - now;

        if (timeDiff > 0) {
            setTimeout(() => {
                if (Notification.permission === 'granted') {
                    new Notification('Reminder', {
                        body: `Don't forget: ${noteTitle}`,
                        icon: 'https://example.com/reminder-icon.png'
                    });
                } else {
                    alert(`Reminder: ${noteTitle}`);
                }
            }, timeDiff);
        }
    }

    async function loadAndScheduleReminders() {
        const { data: reminders, error } = await supabase
            .from('reminders')
            .select('*');

        if (error) {
            console.error('Error loading reminders:', error);
        } else {
            reminders.forEach(reminder => {
                setReminder(reminder.dateTime, reminder.noteTitle);
            });
        }
    }

    document.querySelector('.search-btn').addEventListener('click', function() {
        const searchBar = document.getElementById('search-bar');
        searchBar.style.display = searchBar.style.display === 'block' ? 'none' : 'block';
        searchBar.focus();
    });

    document.getElementById('search-bar').addEventListener('input', function() {
        const query = this.value.toLowerCase();
        document.querySelectorAll('.note-item').forEach(note => {
            const title = note.querySelector('h3').textContent.toLowerCase();
            const content = note.querySelector('.note-body').textContent.toLowerCase();
            if (title.includes(query) || content.includes(query)) {
                note.style.display = 'block';
            } else {
                note.style.display = 'none';
            }
        });
    });

    document.getElementById('dark-mode-toggle').addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
    });

    document.getElementById('export-notes').addEventListener('click', function() {
        const notes = JSON.stringify(JSON.parse(localStorage.getItem('notes')) || []);
        const blob = new Blob([notes], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-notes').addEventListener('change', function(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function() {
            const notes = JSON.parse(reader.result);
            localStorage.setItem('notes', JSON.stringify(notes));
            loadNotesFromDatabase();
            updateTagSuggestions();
        };
        reader.readAsText(file);
    });

    window.addEventListener('load', () => {
        loadNotesFromDatabase();
        updateTagSuggestions();
        loadAndScheduleReminders();
    });
});

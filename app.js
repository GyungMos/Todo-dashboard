const app = {
    data: {
        tasks: [],
        folders: ["기본 업무", "연차 신청", "프로젝트 A"],
        members: ["강민구", "김철수", "이영희", "박지민", "최유진"],
        currentFolder: "all",
        selectedMembers: [],
        tempSubTasks: [], // For task creation/edit form
        statFilter: "all" // Dashboard filter state
    },

    async init() {
        await this.loadData();
        this.renderFolders();
        this.renderMembers();
        this.renderTasks();
        this.updateFolderSelect();
        this.updateFilterOptions();
        this.setupEventListeners();
        this.selectFolder('all'); // 기본 화면을 전체 업무 내역으로 설정
        console.log("Application Initialized");
    },

    setupEventListeners() {
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddTask();
        });
    },

    async loadData() {
        try {
            const response = await fetch('/api/data');
            const data = await response.json();
            this.data.tasks = data.tasks || [];
            this.data.folders = data.folders || ["기본 업무", "연차 신청", "프로젝트 A"];
            this.data.members = data.members || ["강민구", "김철수", "이영희", "박지민", "최유진"];
            this.data.currentFolder = data.currentFolder || "all";
        } catch (error) {
            console.error('Failed to load data:', error);
            // Fallback to localStorage if server is not available
            const savedData = localStorage.getItem('pyungwoo_task_data');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.data.tasks = parsed.tasks || [];
                this.data.folders = parsed.folders || this.data.folders;
                this.data.members = parsed.members || this.data.members;
            }
        }
    },

    async saveData() {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tasks: this.data.tasks,
                    folders: this.data.folders,
                    members: this.data.members,
                    currentFolder: this.data.currentFolder
                })
            });
        } catch (error) {
            console.error('Failed to save data to server:', error);
            // Backup to localStorage
            localStorage.setItem('pyungwoo_task_data', JSON.stringify({
                tasks: this.data.tasks,
                folders: this.data.folders,
                members: this.data.members
            }));
        }
    },

    renderFolders() {
        const folderList = document.getElementById('folderList');
        const settingsFolderList = document.getElementById('settingsFolderList');

        const folderHtml = this.data.folders.map(folder => `
            <div class="folder-item" data-folder="${folder}" onclick="app.selectFolder('${folder}')">
                <span>📁 ${folder}</span>
            </div>
        `).join('');

        folderList.innerHTML = folderHtml;

        if (settingsFolderList) {
            settingsFolderList.innerHTML = this.data.folders.map(folder => `
                <div class="settings-item">
                    <span id="folder-name-${folder}">${folder}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-delete" style="color: var(--primary-color);" onclick="app.handleEditFolder('${folder}')">수정</button>
                        <button class="btn-delete" onclick="app.handleDeleteFolder('${folder}')">삭제</button>
                    </div>
                </div>
            `).join('');
        }
    },

    renderMembersInSettings() {
        const settingsMemberList = document.getElementById('settingsMemberList');
        if (settingsMemberList) {
            settingsMemberList.innerHTML = this.data.members.map(member => `
                <div class="settings-item">
                    <span>${member}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-delete" style="color: var(--primary-color);" onclick="app.handleEditMember('${member}')">수정</button>
                        <button class="btn-delete" onclick="app.handleDeleteMember('${member}')">삭제</button>
                    </div>
                </div>
            `).join('');
        }
    },

    updateFolderSelect() {
        const folderSelect = document.getElementById('folderSelect');
        folderSelect.innerHTML = this.data.folders.map(folder => `
            <option value="${folder}">${folder}</option>
        `).join('');
    },

    renderMembers() {
        const memberSelector = document.getElementById('memberSelector');
        memberSelector.innerHTML = this.data.members.map(member => `
            <div class="member-chip ${this.data.selectedMembers.includes(member) ? 'selected' : ''}" 
                 onclick="app.toggleMember('${member}')">
                ${member}
            </div>
        `).join('');
    },

    toggleMember(member) {
        const index = this.data.selectedMembers.indexOf(member);
        if (index > -1) {
            this.data.selectedMembers.splice(index, 1);
        } else {
            this.data.selectedMembers.push(member);
        }
        this.renderMembers();
    },

    async selectFolder(folder) {
        this.data.currentFolder = folder;
        this.data.statFilter = 'all'; // Reset stat filter on folder change

        const folderNameDisplay = folder === 'all' ? '전체 업무 내역' : (folder === 'all_with_form' ? '업무 등록' : folder);
        document.getElementById('currentFolderName').textContent = folderNameDisplay;

        const taskForm = document.getElementById('taskForm');
        // Only show form on Main page ('all_with_form')
        if (folder === 'all_with_form') {
            taskForm.style.display = 'block';
        } else {
            taskForm.style.display = 'none';
        }

        this.updateSidebarUI();
        this.renderTasks();
        await this.saveData(); // Save current folder state

        // Scroll to top on navigation
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateSidebarUI() {
        // 1. Clear all active classes
        document.querySelectorAll('.sidebar .folder-item, .sidebar .btn-settings').forEach(item => {
            item.classList.remove('active');
        });

        // 2. Set active based on current state
        if (document.getElementById('settingsView').style.display === 'flex') {
            document.getElementById('settingsMenu').classList.add('active');
        } else if (this.data.currentFolder === 'all') {
            document.getElementById('allTasksMenu').classList.add('active');
        } else if (this.data.currentFolder === 'all_with_form') {
            document.getElementById('mainMenu').classList.add('active');
        } else {
            // Find the dynamic folder item using data attribute
            const activeFolderItem = document.querySelector(`#folderList .folder-item[data-folder="${this.data.currentFolder}"]`);
            if (activeFolderItem) {
                activeFolderItem.classList.add('active');
            }
        }
    },

    updateFilterOptions() {
        const filterCategory = document.getElementById('filterCategory');
        const filterAssignee = document.getElementById('filterAssignee');

        if (filterCategory) {
            const current = filterCategory.value;
            filterCategory.innerHTML = '<option value="all">모든 카테고리</option>' +
                this.data.folders.map(f => `<option value="${f}" ${f === current ? 'selected' : ''}>${f}</option>`).join('');
        }

        if (filterAssignee) {
            const current = filterAssignee.value;
            filterAssignee.innerHTML = '<option value="all">모든 담당자</option>' +
                this.data.members.map(m => `<option value="${m}" ${m === current ? 'selected' : ''}>${m}</option>`).join('');
        }
    },

    handleFilterChange() {
        this.renderTasks();
    },

    async goToMain() {
        await this.selectFolder('all_with_form');
    },

    handleAddSubTask() {
        const input = document.getElementById('subTaskInput');
        const text = input.value.trim();
        if (text) {
            this.data.tempSubTasks.push({ text, completed: false });
            input.value = '';
            this.renderSubTasksInForm();
        }
    },

    handleRemoveSubTask(index) {
        this.data.tempSubTasks.splice(index, 1);
        this.renderSubTasksInForm();
    },

    renderSubTasksInForm() {
        const list = document.getElementById('subTaskFormList');
        list.innerHTML = this.data.tempSubTasks.map((st, index) => `
            <div class="subtask-form-item">
                <span style="flex: 1;">${st.text}</span>
                <button type="button" class="btn-remove" onclick="app.handleRemoveSubTask(${index})">&times;</button>
            </div>
        `).join('');
    },

    async handleAddTask() {
        const title = document.getElementById('titleInput').value;
        const folder = document.getElementById('folderSelect').value;
        const priority = document.getElementById('prioritySelect').value;
        const startDate = document.getElementById('startDateInput').value;
        const endDate = document.getElementById('endDateInput').value;
        const notes = document.getElementById('notesInput').value;
        const editId = document.getElementById('editTaskId').value;

        let leaveDays = 0;
        if (startDate && endDate) {
            // 방어 코드: 연도가 4자리를 넘는 경우 9999로 제한
            const fixYear = (dateStr) => {
                const parts = dateStr.split('-');
                if (parts[0].length > 4) parts[0] = '9999';
                return parts.join('-');
            };
            const finalStart = fixYear(startDate);
            const finalEnd = fixYear(endDate);

            const start = new Date(finalStart);
            const end = new Date(finalEnd);
            const diffTime = Math.abs(end - start);
            leaveDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        if (editId) {
            // Edit existing task
            const index = this.data.tasks.findIndex(t => t.id == editId);
            if (index > -1) {
                this.data.tasks[index] = {
                    ...this.data.tasks[index],
                    title, folder, priority, startDate, endDate, leaveDays,
                    members: [...this.data.selectedMembers],
                    notes,
                    subtasks: [...this.data.tempSubTasks]
                };
            }
            this.cancelEdit();
        } else {
            // Add new task
            const newTask = {
                id: Date.now(),
                title, folder, priority, startDate, endDate, leaveDays,
                members: [...this.data.selectedMembers],
                notes,
                subtasks: [...this.data.tempSubTasks],
                completed: false,
                createdAt: new Date().toISOString()
            };
            this.data.tasks.unshift(newTask);
            this.syncWithECount(newTask);
        }

        await this.saveData();
        this.renderTasks();

        // Reset form
        this.cancelEdit();
    },

    handleEditTask(id) {
        const task = this.data.tasks.find(t => t.id == id);
        if (!task) return;

        // Force switch to Main page to see the form
        this.selectFolder('all_with_form');

        document.getElementById('editTaskId').value = task.id;
        document.getElementById('titleInput').value = task.title;
        document.getElementById('folderSelect').value = task.folder;
        document.getElementById('prioritySelect').value = task.priority || 'normal';
        document.getElementById('startDateInput').value = task.startDate;
        document.getElementById('endDateInput').value = task.endDate;
        document.getElementById('notesInput').value = task.notes;

        this.data.selectedMembers = [...task.members];
        this.data.tempSubTasks = task.subtasks ? [...task.subtasks] : [];
        this.renderMembers();
        this.renderSubTasksInForm();

        document.getElementById('submitBtn').textContent = '업무 수정하기';
        document.getElementById('cancelEditBtn').style.display = 'block';

        // Scroll to form
        document.getElementById('taskForm').scrollIntoView({ behavior: 'smooth' });
    },

    async handleDeleteTask(id) {
        if (confirm('이 업무를 삭제하시겠습니까?')) {
            this.data.tasks = this.data.tasks.filter(t => t.id != id);
            await this.saveData();
            this.renderTasks();
        }
    },

    cancelEdit() {
        document.getElementById('editTaskId').value = '';
        document.getElementById('taskForm').reset();
        document.getElementById('submitBtn').textContent = '업무 등록하기';
        document.getElementById('cancelEditBtn').style.display = 'none';
        this.data.selectedMembers = [];
        this.data.tempSubTasks = [];
        this.renderMembers();
        this.renderSubTasksInForm();
    },

    async toggleSubTask(taskId, subIndex) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (task && task.subtasks && task.subtasks[subIndex]) {
            task.subtasks[subIndex].completed = !task.subtasks[subIndex].completed;
            await this.saveData();
            this.renderTasks();
        }
    },

    setStatFilter(filterType) {
        this.data.statFilter = filterType;
        this.renderTasks();
        // Scroll to active task list for better UX
        const activeList = document.getElementById('activeTaskList');
        if (activeList) activeList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    renderTasks() {
        const activeList = document.getElementById('activeTaskList');
        const completedList = document.getElementById('completedTaskList');

        const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
        const sortedTasks = [...this.data.tasks].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const pDiff = (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
            if (pDiff !== 0) return pDiff;
            return new Date(a.endDate) - new Date(b.endDate);
        });

        const searchQuery = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('filterCategory').value;
        const assigneeFilter = document.getElementById('filterAssignee').value;
        const priorityFilter = document.getElementById('filterPriority').value;

        // Current view base tasks (respecting category selection)
        const statsBaseTasks = this.data.tasks.filter(task => {
            if (this.data.currentFolder === 'all' || this.data.currentFolder === 'all_with_form') return true;
            return task.folder === this.data.currentFolder;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalCount = statsBaseTasks.length;
        const activeCount = statsBaseTasks.filter(t => !t.completed).length;
        const completedCount = statsBaseTasks.filter(t => t.completed).length;
        const urgentCount = statsBaseTasks.filter(t => {
            if (t.completed) return false;
            const end = new Date(t.endDate);
            const diff = (end - today) / (1000 * 60 * 60 * 24);
            return diff <= 3 && diff >= 0;
        }).length;

        document.getElementById('totalTasksCount').textContent = totalCount;
        document.getElementById('activeTasksCount').textContent = activeCount;
        document.getElementById('urgentTasksCount').textContent = urgentCount;
        document.getElementById('completedTasksCount').textContent = completedCount;

        // Update Dashboard Active State
        document.querySelectorAll('.stats-card').forEach(card => card.classList.remove('active-filter'));
        const activeCardId = `stat-${this.data.statFilter}`;
        if (document.getElementById(activeCardId)) {
            document.getElementById(activeCardId).classList.add('active-filter');
        }

        // Label update for stats
        const isMainPage = this.data.currentFolder === 'all_with_form';
        const statsLabel = this.data.currentFolder === 'all' || isMainPage ? '전체' : `'${this.data.currentFolder}'`;
        const statsLabelElem = document.querySelectorAll('.stats-label')[0];
        if (statsLabelElem) statsLabelElem.textContent = `${statsLabel} 업무`;

        // Hide stats and lists on Registration page
        const statsDashboard = document.querySelector('.stats-grid');
        const activeContainer = document.querySelector('.section:nth-of-type(1)'); // Active Tasks section
        const completedContainer = document.querySelector('.section:nth-of-type(2)'); // Completed Tasks section

        if (isMainPage) {
            if (statsDashboard) statsDashboard.style.display = 'none';
            if (activeList.parentElement) activeList.parentElement.style.display = 'none';
            if (completedList.parentElement) completedList.parentElement.style.display = 'none';
        } else {
            if (statsDashboard) statsDashboard.style.display = 'grid';
            if (activeList.parentElement) activeList.parentElement.style.display = 'block';
            if (completedList.parentElement) completedList.parentElement.style.display = 'block';
        }

        const filteredTasks = sortedTasks.filter(task => {
            // 1. Sidebar Category Filter
            const matchesSidebar = this.data.currentFolder === 'all' ||
                this.data.currentFolder === 'all_with_form' ||
                task.folder === this.data.currentFolder;
            if (!matchesSidebar) return false;

            // 2. Search & Select Filters
            const matchesSearch = task.title.toLowerCase().includes(searchQuery) ||
                (task.notes && task.notes.toLowerCase().includes(searchQuery));
            if (!matchesSearch) return false;

            if (categoryFilter !== 'all' && task.folder !== categoryFilter) return false;
            if (assigneeFilter !== 'all' && !task.members.includes(assigneeFilter)) return false;
            if (priorityFilter !== 'all' && (task.priority || 'normal') !== priorityFilter) return false;

            // 3. Stat Card Filter
            if (this.data.statFilter === 'active') return !task.completed;
            if (this.data.statFilter === 'completed') return task.completed;
            if (this.data.statFilter === 'urgent') {
                if (task.completed) return false;
                const end = new Date(task.endDate);
                const diff = (end - today) / (1000 * 60 * 60 * 24);
                return diff <= 3 && diff >= 0;
            }

            return true; // 'all' filter
        });

        const calculateDDay = (endDate) => {
            const t = new Date();
            t.setHours(0, 0, 0, 0);
            const target = new Date(endDate);
            target.setHours(0, 0, 0, 0);
            const diff = target - t;
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days === 0) return '<span class="d-day today">D-Day</span>';
            if (days < 0) return `<span class="d-day expired">만료 (${Math.abs(days)}일 전)</span>`;
            return `<span class="d-day">D-${days}</span>`;
        };

        const createTaskHtml = (task) => {
            const isAnnualLeave = task.folder === '연차 신청';
            const annualLeaveBadge = isAnnualLeave ? '<span class="badge leave">연차</span>' : '';
            const ddayHtml = task.completed ? '' : calculateDDay(task.endDate);
            const prioClass = `prio-${task.priority || 'normal'}`;
            const prioText = { urgent: '긴급', high: '높음', normal: '보통', low: '낮음' }[task.priority || 'normal'];

            const subTasksHtml = task.subtasks && task.subtasks.length > 0 ? `
                <div class="subtasks-container">
                    ${task.subtasks.map((st, index) => `
                        <div class="subtask-item" onclick="app.toggleSubTask(${task.id}, ${index})">
                            <div class="subtask-checkbox ${st.completed ? 'checked' : ''}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            </div>
                            <span class="subtask-text ${st.completed ? 'completed' : ''}">${st.text}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';

            return `
                <div class="task-card ${isAnnualLeave ? 'task-leave' : ''}">
                    <div class="task-info">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            ${annualLeaveBadge}
                            <span class="prio-badge ${prioClass}">${prioText}</span>
                            <span class="category-tag">${task.folder}</span>
                            ${ddayHtml}
                        </div>
                        <h4>${task.title}</h4>
                        <div class="task-meta">
                            <span>📅 ${task.startDate} ~ ${task.endDate} (${task.leaveDays}일)</span>
                            <span>👤 담당자: ${task.members.join(', ')}</span>
                        </div>
                        ${subTasksHtml}
                        ${task.notes ? `<p class="task-desc">${task.notes}</p>` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1rem;">
                        <button class="btn-complete ${task.completed ? 'active' : ''}" onclick="app.toggleComplete(${task.id})" title="${task.completed ? '진행중으로 변경' : '완료 처리'}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </button>
                        <div class="task-actions">
                            <button class="btn-icon edit" onclick="app.handleEditTask(${task.id})" title="수정">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            </button>
                            <button class="btn-icon delete" onclick="app.handleDeleteTask(${task.id})" title="삭제">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        };

        if (activeList) activeList.innerHTML = filteredTasks.filter(t => !t.completed).map(createTaskHtml).join('') ||
            '<div style="text-align: center; color: var(--text-muted); padding: 3rem; background: var(--card-bg); border-radius: 1rem; border: 1px dashed var(--border-color);">진행 중인 업무가 없습니다. ✨</div>';

        if (completedList) completedList.innerHTML = filteredTasks.filter(t => t.completed).map(createTaskHtml).join('') ||
            '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">완료된 업무가 아직 없습니다.</div>';
    },

    async toggleComplete(id) {
        const task = this.data.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            await this.saveData();
            this.renderTasks();
        }
    },

    handleSearch(event) {
        // 기존 handleSearch 기능은 handleFilterChange에 흡수되었습니다.
    },

    toggleSettings(show) {
        const settings = document.getElementById('settingsView');
        if (settings) settings.style.display = show ? 'flex' : 'none';
        if (show) {
            this.switchSettingsTab('category'); // Default to category tab
            this.renderFolders();
            this.renderMembersInSettings();
        }
        this.updateSidebarUI();
    },

    switchSettingsTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.settings-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeTabBtn = document.getElementById(`tab-${tabId}`);
        if (activeTabBtn) activeTabBtn.classList.add('active');

        // Update tab content
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`settings${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Tab`);
        if (activeContent) activeContent.classList.add('active');
    },

    async handleAddFolder() {
        const name = document.getElementById('newFolderName').value.trim();
        if (name && !this.data.folders.includes(name)) {
            this.data.folders.push(name);
            await this.saveData();
            this.renderFolders();
            this.updateFolderSelect();
            this.updateFilterOptions();
            document.getElementById('newFolderName').value = '';
        }
    },

    async handleEditFolder(oldName) {
        const newName = prompt(`'${oldName}' 카테고리의 새 이름을 입력하세요:`, oldName);
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedName = newName.trim();
            if (this.data.folders.includes(trimmedName)) {
                alert("이미 존재하는 카테고리 이름입니다.");
                return;
            }

            const index = this.data.folders.indexOf(oldName);
            if (index > -1) {
                this.data.folders[index] = trimmedName;

                this.data.tasks.forEach(task => {
                    if (task.folder === oldName) task.folder = trimmedName;
                });

                await this.saveData();
                this.renderFolders();
                this.updateFolderSelect();
                this.updateFilterOptions();
                this.renderTasks();
            }
        }
    },

    async handleDeleteFolder(folder) {
        if (confirm(`'${folder}' 카테고리를 삭제하시겠습니까? 해당 카테고리의 업무는 유지되지만 카테고리 정보가 사라집니다.`)) {
            this.data.folders = this.data.folders.filter(f => f !== folder);
            await this.saveData();
            this.renderFolders();
            this.updateFolderSelect();
            this.updateFilterOptions();
            this.renderTasks();
        }
    },

    async handleAddMember() {
        const input = document.getElementById('newMemberName');
        const name = input.value.trim();
        if (name && !this.data.members.includes(name)) {
            this.data.members.push(name);
            await this.saveData();
            this.renderMembersInSettings();
            this.renderMembers();
            this.updateFilterOptions();
            input.value = '';
        } else if (this.data.members.includes(name)) {
            alert("이미 등록된 담당자입니다.");
        }
    },

    async handleEditMember(oldName) {
        const newName = prompt(`'${oldName}' 담당자의 새 이름을 입력하세요:`, oldName);
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedName = newName.trim();
            if (this.data.members.includes(trimmedName)) {
                alert("이미 존재하는 담당자 이름입니다.");
                return;
            }

            const index = this.data.members.indexOf(oldName);
            if (index > -1) {
                this.data.members[index] = trimmedName;

                this.data.tasks.forEach(task => {
                    const mIndex = task.members.indexOf(oldName);
                    if (mIndex > -1) task.members[mIndex] = trimmedName;
                });

                await this.saveData();
                this.renderMembersInSettings();
                this.renderMembers();
                this.updateFilterOptions();
                this.renderTasks();
            }
        }
    },

    async handleDeleteMember(member) {
        if (confirm(`'${member}' 담당자를 삭제하시겠습니까?`)) {
            this.data.members = this.data.members.filter(m => m !== member);
            await this.saveData();
            this.renderMembersInSettings();
            this.renderMembers();
            this.updateFilterOptions();
            this.renderTasks();
        }
    },

    exportData() {
        const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pyungwoo_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.tasks && imported.folders) {
                    this.data.tasks = imported.tasks;
                    this.data.folders = imported.folders;
                    this.data.members = imported.members || this.data.members;
                    await this.saveData();
                    this.init();
                    this.updateFilterOptions();
                    alert("데이터를 성공적으로 불러왔습니다.");
                }
            } catch (err) {
                alert("유효하지 않은 파일 형식입니다.");
            }
        };
        reader.readAsText(file);
    },

    syncWithECount(task) {
        console.log("Syncing with E-Count API...", task);
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());

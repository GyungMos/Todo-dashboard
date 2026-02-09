const app = {
    data: {
        tasks: [],
        folders: [
            { name: "기본 업무", parent: null },
            { name: "연차 신청", parent: null },
            { name: "프로젝트 A", parent: null }
        ],
        members: ["강민구", "김철수", "이영희", "박지민", "최유진"],
        currentFolder: "all",
        selectedMembers: [],
        tempSubTasks: [], // For task creation/edit form
        statFilter: "all", // Dashboard filter state
        collapsedFolders: [] // Folders that are currently collapsed
    },
    // 프리미엄 컬러 팔레트 (Professional & Soft)
    colors: [
        "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
        "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#3b82f6",
        "#64748b", "#a855f7"
    ],
    calendar: null,
    charts: {
        weeklyTrend: null,
        categoryDist: null
    },

    async init() {
        await this.loadData();
        this.renderFolders();
        this.renderMembers();
        this.renderTasks();
        this.updateFolderSelect();
        this.updateFilterOptions();
        this.initCharts();
        this.setupEventListeners();
        this.selectFolder('dashboard'); // 대시보드를 기본 화면으로 설정
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

            // 데이터 마이그레이션: 문자열 배열을 객체 배열로 변환 및 색상 할당
            if (data.folders && data.folders.length > 0) {
                if (typeof data.folders[0] === 'string') {
                    this.data.folders = data.folders.map((f, i) => ({
                        name: f,
                        parent: null,
                        color: this.colors[i % this.colors.length]
                    }));
                } else {
                    this.data.folders = data.folders.map((f, i) => ({
                        ...f,
                        color: f.color || this.colors[i % this.colors.length]
                    }));
                }
            } else {
                this.data.folders = this.data.folders.map((f, i) => ({
                    ...f,
                    color: f.color || this.colors[i % this.colors.length]
                }));
            }

            this.data.members = data.members || ["강민구", "김철수", "이영희", "박지민", "최유진"];
            this.data.currentFolder = data.currentFolder || "all";
            this.data.collapsedFolders = data.collapsedFolders || [];
        } catch (error) {
            console.error('Failed to load data:', error);
            // Fallback to localStorage if server is not available
            const savedData = localStorage.getItem('pyungwoo_task_data');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.data.tasks = parsed.tasks || [];

                if (parsed.folders && parsed.folders.length > 0 && typeof parsed.folders[0] === 'string') {
                    this.data.folders = parsed.folders.map(f => ({ name: f, parent: null }));
                } else {
                    this.data.folders = parsed.folders || this.data.folders;
                }

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
                    currentFolder: this.data.currentFolder,
                    collapsedFolders: this.data.collapsedFolders
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
        if (!folderList) return;

        // 재귀적으로 폴더를 정렬된 평탄한 배열로 변환하는 헬퍼 함수
        const getSortedFolders = (parentId = null, depth = 0, isParentCollapsed = false) => {
            let result = [];
            const children = this.data.folders.filter(f => f.parent === parentId);

            children.forEach(c => {
                const isCollapsed = this.data.collapsedFolders.includes(c.name);
                const hasChildren = this.data.folders.some(f => f.parent === c.name);

                // 부모가 접혀있지 않을 때만 결과에 추가
                if (!isParentCollapsed) {
                    result.push({ ...c, depth, hasChildren, isCollapsed });
                }

                // 자식 노드 탐색 (상위가 접혀있으면 자식들도 '접힌 부모 상태'로 전달)
                const childrenNodes = getSortedFolders(c.name, depth + 1, isParentCollapsed || isCollapsed);
                result = result.concat(childrenNodes);
            });
            return result;
        };

        const sortedFolders = getSortedFolders();

        const folderHtml = sortedFolders.map(folder => {
            const index = this.data.folders.findIndex(f => f.name === folder.name);
            const isCollapsed = folder.isCollapsed;
            const hasChildren = folder.hasChildren;

            return `
                <div class="folder-item depth-${folder.depth} ${this.data.currentFolder === folder.name ? 'active' : ''}" 
                     data-folder="${folder.name}" onclick="app.selectFolder('${folder.name}')"
                     style="padding-left: ${0.5 + (folder.depth * 1.2)}rem">
                    <div style="display: flex; align-items: center; flex: 1; overflow: hidden;">
                        ${hasChildren ? `
                            <div class="folder-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="event.stopPropagation(); app.toggleFolderCollapse('${folder.name}')">
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        ` : '<div style="width: 20px;"></div>'}
                        <div class="folder-color-dot" style="background-color: ${folder.color || '#6366f1'}"></div>
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${folder.name}</span>
                    </div>
                    <div class="reorder-btns" onclick="event.stopPropagation()">
                        <button class="btn-reorder" onclick="app.moveItem('folder', ${index}, -1)" title="위로">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <button class="btn-reorder" onclick="app.moveItem('folder', ${index}, 1)" title="아래로">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        folderList.innerHTML = folderHtml;
    },

    toggleFolderCollapse(folderName) {
        const index = this.data.collapsedFolders.indexOf(folderName);
        if (index > -1) {
            this.data.collapsedFolders.splice(index, 1);
        } else {
            this.data.collapsedFolders.push(folderName);
        }
        this.saveData();
        this.renderFolders();
    },

    renderFolderSettings() {
        const settingsFolderList = document.getElementById('settingsFolderList');
        const parentFolderSelect = document.getElementById('parentFolderSelect');

        if (settingsFolderList) {
            const getSortedFolders = (parentId = null, depth = 0) => {
                let result = [];
                const children = this.data.folders.filter(f => f.parent === parentId);
                children.forEach(c => {
                    result.push({ ...c, depth });
                    result = result.concat(getSortedFolders(c.name, depth + 1));
                });
                return result;
            };

            const sortedFolders = getSortedFolders();

            settingsFolderList.innerHTML = sortedFolders.map(folder => {
                const index = this.data.folders.findIndex(f => f.name === folder.name);
                return `
                    <div class="settings-item" style="padding-left: ${0.75 + (folder.depth * 1.5)}rem">
                        <div style="display: flex; align-items: center; flex: 1;">
                            <div class="folder-color-dot" style="background-color: ${folder.color || '#6366f1'}"></div>
                            <span id="folder-name-${folder.name}">${folder.depth > 0 ? '┕ ' : ''} ${folder.name}</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <div class="reorder-btns" onclick="event.stopPropagation()">
                                <button class="btn-reorder" onclick="app.moveItem('folder', ${index}, -1)" title="위로">
                                    <i class="fas fa-chevron-up"></i>
                                </button>
                                <button class="btn-reorder" onclick="app.moveItem('folder', ${index}, 1)" title="아래로">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                            <button class="btn-delete" style="color: var(--primary-color);" onclick="app.handleEditFolder('${folder.name}')">수정</button>
                            <button class="btn-delete" onclick="app.handleDeleteFolder('${folder.name}')">삭제</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (parentFolderSelect) {
            const getSortedFolders = (parentId = null, depth = 0) => {
                let result = [];
                const children = this.data.folders.filter(f => f.parent === parentId);
                children.forEach(c => {
                    result.push({ name: c.name, depth });
                    result = result.concat(getSortedFolders(c.name, depth + 1));
                });
                return result;
            };
            const sorted = getSortedFolders();
            parentFolderSelect.innerHTML = '<option value="">부모 카테고리 없음 (상위)</option>' +
                sorted.map(f => `<option value="${f.name}">${'&nbsp;'.repeat(f.depth * 4)}${f.depth > 0 ? '┕ ' : ''}${f.name}</option>`).join('');
        }
    },

    renderMembersInSettings() {
        const settingsMemberList = document.getElementById('settingsMemberList');
        if (settingsMemberList) {
            settingsMemberList.innerHTML = this.data.members.map((member, index) => `
                <div class="settings-item">
                    <span style="flex: 1;">${member}</span>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <div class="reorder-btns" onclick="event.stopPropagation()">
                            <button class="btn-reorder" onclick="app.moveItem('member', ${index}, -1)" title="위로">
                                <i class="fas fa-chevron-up"></i>
                            </button>
                            <button class="btn-reorder" onclick="app.moveItem('member', ${index}, 1)" title="아래로">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
                        <button class="btn-delete" style="color: var(--primary-color);" onclick="app.handleEditMember('${member}')">수정</button>
                        <button class="btn-delete" onclick="app.handleDeleteMember('${member}')">삭제</button>
                    </div>
                </div>
            `).join('');
        }
    },

    updateFolderSelect() {
        const folderSelect = document.getElementById('folderSelect');
        if (!folderSelect) return;

        const getSortedFolders = (parentId = null, depth = 0) => {
            let result = [];
            const children = this.data.folders.filter(f => f.parent === parentId);
            children.forEach(c => {
                const label = '&nbsp;'.repeat(depth * 4) + (depth > 0 ? '┕ ' : '') + c.name;
                result.push({ name: c.name, label });
                result = result.concat(getSortedFolders(c.name, depth + 1));
            });
            return result;
        };

        const grouped = getSortedFolders();
        folderSelect.innerHTML = grouped.map(folder => `
            <option value="${folder.name}">${folder.label}</option>
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

    toggleTheme() {
        const body = document.body;
        const newTheme = body.dataset.theme === 'dark' ? 'light' : 'dark';
        body.dataset.theme = newTheme;

        const isDark = newTheme === 'dark';
        const textColor = isDark ? '#f8fafc' : '#1e293b';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

        if (this.charts.weeklyTrend) {
            this.charts.weeklyTrend.options.scales.x.ticks.color = textColor;
            this.charts.weeklyTrend.options.scales.y.ticks.color = textColor;
            this.charts.weeklyTrend.options.scales.x.grid.color = gridColor;
            this.charts.weeklyTrend.options.scales.y.grid.color = gridColor;
            this.charts.weeklyTrend.update();
        }

        if (this.charts.categoryDist) {
            this.charts.categoryDist.options.plugins.legend.labels.color = textColor;
            this.charts.categoryDist.update();
        }
    },

    async selectFolder(folder) {
        this.data.currentFolder = folder;
        this.data.statFilter = 'all';

        const folderNameDisplay = folder === 'dashboard' ? 'DashBoard' :
            (folder === 'all' ? '전체 업무 목록' :
                (folder === 'all_with_form' ? '업무 등록' : folder));
        document.getElementById('currentFolderName').textContent = folderNameDisplay;

        const taskForm = document.getElementById('taskForm');
        const taskListView = document.getElementById('taskListView');
        const dashboardView = document.getElementById('dashboardView');
        const calendarView = document.getElementById('calendarView');

        taskForm.style.display = 'none';
        taskListView.style.display = 'none';
        dashboardView.style.display = 'none';
        calendarView.style.display = 'none';

        if (folder === 'dashboard') {
            dashboardView.style.display = 'block';
            this.updateCharts(this.data.tasks);
            this.updateDashboardWidgets(this.data.tasks);
        } else if (folder === 'all_with_form') {
            taskForm.style.display = 'block';
            taskListView.style.display = 'block';
        } else {
            taskListView.style.display = 'block';
        }

        this.updateSidebarUI();
        this.renderTasks();
        await this.saveData();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    toggleCalendarView(show) {
        const taskListView = document.getElementById('taskListView');
        const calendarView = document.getElementById('calendarView');
        const searchBar = document.querySelector('.filter-section');

        if (show) {
            taskListView.style.display = 'none';
            calendarView.style.display = 'block';
            if (searchBar) searchBar.style.display = 'none';
            this.data.currentFolder = 'calendar';
            this.initCalendar();
        } else {
            taskListView.style.display = 'block';
            calendarView.style.display = 'none';
            if (searchBar) searchBar.style.display = 'block';
        }
        this.updateSidebarUI();
    },

    initCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        if (this.calendar) {
            this.calendar.render();
            this.updateCalendarEvents();
            return;
        }

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ko',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            height: 'auto',
            events: this.getCalendarEvents(),
            eventClick: (info) => {
                const taskId = info.event.id;
                this.handleEditTask(taskId);
            },
            eventDidMount: (info) => {
                const priority = info.event.extendedProps.priority || 'normal';
                const completed = info.event.extendedProps.completed;
                if (completed) {
                    info.el.classList.add('event-completed');
                } else {
                    info.el.classList.add(`event-${priority}`);
                }
            }
        });

        this.calendar.render();
    },

    getCalendarEvents() {
        return this.data.tasks.map(task => {
            const folder = this.data.folders.find(f => f.name === task.folder);
            const color = folder ? folder.color : '#6366f1';

            return {
                id: task.id,
                title: task.title,
                start: task.startDate,
                end: task.endDate ? this.getNextDay(task.endDate) : task.startDate,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    priority: task.priority,
                    completed: task.completed
                }
            };
        });
    },

    updateCalendarEvents() {
        if (this.calendar) {
            this.calendar.removeAllEvents();
            this.calendar.addEventSource(this.getCalendarEvents());
        }
    },

    getNextDay(dateStr) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + 1);
        return date.toISOString().split('T')[0];
    },

    updateSidebarUI() {
        document.querySelectorAll('.sidebar .folder-item, .sidebar .btn-settings').forEach(item => {
            item.classList.remove('active');
        });

        if (document.getElementById('settingsView').style.display === 'flex') {
            document.getElementById('settingsMenu').classList.add('active');
        } else if (document.getElementById('calendarView').style.display === 'block') {
            document.getElementById('calendarMenu').classList.add('active');
        } else if (this.data.currentFolder === 'dashboard') {
            document.getElementById('dashboardMenu').classList.add('active');
        } else if (this.data.currentFolder === 'all') {
            document.getElementById('allTasksMenu').classList.add('active');
        } else if (this.data.currentFolder === 'all_with_form') {
            document.getElementById('mainMenu').classList.add('active');
        } else {
            const activeFolderItem = document.querySelector(`.sidebar .folder-item[data-folder="${this.data.currentFolder}"]`);
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
            const getSortedFolders = (parentId = null, depth = 0) => {
                let result = [];
                const children = this.data.folders.filter(f => f.parent === parentId);
                children.forEach(c => {
                    const label = '\u00A0'.repeat(depth * 2) + (depth > 0 ? '\u2514 ' : '') + c.name;
                    result.push({ name: c.name, label });
                    result = result.concat(getSortedFolders(c.name, depth + 1));
                });
                return result;
            };

            const grouped = getSortedFolders();

            filterCategory.innerHTML = '<option value="all">모든 카테고리</option>' +
                grouped.map(f => `<option value="${f.name}" ${f.name === current ? 'selected' : ''}>${f.label}</option>`).join('');
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

        let successMessage = "";
        if (editId) {
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
            successMessage = "업무 수정이 완료되었습니다.";
            this.cancelEdit();
        } else {
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
            successMessage = "업무 등록이 완료되었습니다.";
        }

        await this.saveData();
        this.renderTasks();
        this.cancelEdit();
        alert(successMessage);
    },

    handleEditTask(id) {
        const task = this.data.tasks.find(t => t.id == id);
        if (!task) return;

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
        const taskForm = document.getElementById('taskForm');
        if (taskForm) taskForm.reset();
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
        const activeList = document.getElementById('activeTaskList');
        if (activeList) activeList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    renderTasks() {
        const activeList = document.getElementById('activeTaskList');
        const completedList = document.getElementById('completedTaskList');

        // Smart Sorting: Priority > Due Date > Created Date
        const priorityOrder = {
            critical: 6, urgent: 5, high: 4,
            normal: 3, low: 2, lowest: 1
        };

        const displayedTasks = [...this.data.tasks].sort((a, b) => {
            // 1. Completed tasks always at the bottom
            if (a.completed !== b.completed) return a.completed ? 1 : -1;

            // 2. Priority: Critical(6) -> Lowest(1)
            const pA = priorityOrder[a.priority] || 3;
            const pB = priorityOrder[b.priority] || 3;
            if (pA !== pB) return pB - pA;

            // 3. Due Date: Ascending (Imminent first)
            const dateA = new Date(a.endDate);
            const dateB = new Date(b.endDate);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA - dateB;
            }

            // 4. Created Date (ID): Descending (Newest first)
            return b.id - a.id;
        });

        const searchQuery = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('filterCategory').value;
        const assigneeFilter = document.getElementById('filterAssignee').value;
        const priorityFilter = document.getElementById('filterPriority').value;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const statsBaseTasks = this.data.tasks.filter(task => {
            if (this.data.currentFolder === 'all' || this.data.currentFolder === 'all_with_form' || this.data.currentFolder === 'dashboard') return true;
            return task.folder === this.data.currentFolder;
        });

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

        document.querySelectorAll('.stats-card').forEach(card => card.classList.remove('active-filter'));
        const activeCardId = `stat-${this.data.statFilter}`;
        if (document.getElementById(activeCardId)) {
            document.getElementById(activeCardId).classList.add('active-filter');
        }

        if (this.data.currentFolder === 'dashboard') {
            const filteredForCharts = statsBaseTasks.filter(task => {
                if (this.data.statFilter === 'all') return true;
                if (this.data.statFilter === 'active') return !task.completed;
                if (this.data.statFilter === 'completed') return task.completed;
                if (this.data.statFilter === 'urgent') {
                    if (task.completed) return false;
                    const end = new Date(task.endDate);
                    const diff = (end - today) / (1000 * 60 * 60 * 24);
                    return diff <= 3 && diff >= 0;
                }
                return true;
            });
            this.updateCharts(filteredForCharts);
            this.updateDashboardWidgets(this.data.tasks);
        }

        const isMainPage = this.data.currentFolder === 'all_with_form';
        const statsLabel = (this.data.currentFolder === 'all' || isMainPage || this.data.currentFolder === 'dashboard') ? '전체' : `'${this.data.currentFolder}'`;
        const statsLabelElem = document.querySelectorAll('.stats-label')[0];
        if (statsLabelElem) statsLabelElem.textContent = `${statsLabel} 업무`;

        const statsDashboard = document.querySelector('.stats-grid');
        if (isMainPage) {
            if (statsDashboard) statsDashboard.style.display = 'none';
            if (activeList.parentElement) activeList.parentElement.style.display = 'none';
            if (completedList.parentElement) completedList.parentElement.style.display = 'none';
        } else {
            if (statsDashboard) statsDashboard.style.display = 'grid';
            if (activeList.parentElement) activeList.parentElement.style.display = 'block';
            if (completedList.parentElement) completedList.parentElement.style.display = 'block';
        }

        const filteredTasks = displayedTasks.filter(task => {
            const matchesSidebar = this.data.currentFolder === 'all' ||
                this.data.currentFolder === 'all_with_form' ||
                task.folder === this.data.currentFolder;
            if (!matchesSidebar) return false;

            const matchesSearch = task.title.toLowerCase().includes(searchQuery) ||
                (task.notes && task.notes.toLowerCase().includes(searchQuery));
            if (!matchesSearch) return false;

            if (categoryFilter !== 'all' && task.folder !== categoryFilter) return false;
            if (assigneeFilter !== 'all' && !task.members.includes(assigneeFilter)) return false;
            if (priorityFilter !== 'all' && (task.priority || 'normal') !== priorityFilter) return false;

            if (this.data.statFilter === 'active') return !task.completed;
            if (this.data.statFilter === 'completed') return task.completed;
            if (this.data.statFilter === 'urgent') {
                if (task.completed) return false;
                const end = new Date(task.endDate);
                const diff = (end - today) / (1000 * 60 * 60 * 24);
                return diff <= 3 && diff >= 0;
            }

            return true;
        });

        const calculateDDay = (endDate) => {
            const t = new Date();
            t.setHours(0, 0, 0, 0);
            const target = new Date(endDate);
            target.setHours(0, 0, 0, 0);
            const diff = target - t;
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days === 0) return '<span class="d-day today">D-Day</span>';
            if (days < 0) return `<span class="d-day expired">만료(${Math.abs(days)}일 전)</span>`;
            return `<span class="d-day">D-${days}</span>`;
        };

        const createTaskHtml = (task) => {
            const isAnnualLeave = task.folder === '연차 신청';
            const annualLeaveBadge = isAnnualLeave ? '<span class="badge leave">연차</span>' : '';
            const ddayHtml = task.completed ? '' : calculateDDay(task.endDate);
            const prioClass = `prio-${task.priority || 'normal'}`;
            const prioText = {
                critical: '최우선', urgent: '긴급', high: '높음',
                normal: '보통', low: '낮음', lowest: '최하'
            }[task.priority || 'normal'];

            const folder = this.data.folders.find(f => f.name === task.folder);
            const categoryColor = folder ? folder.color : 'var(--primary-color)';

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

            const globalIndex = this.data.tasks.findIndex(t => t.id === task.id);

            return `
                <div class="task-card ${isAnnualLeave ? 'task-leave' : ''}">
                    <div class="task-info">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            ${annualLeaveBadge}
                            <span class="prio-badge ${prioClass}">${prioText}</span>
                            <span class="category-tag" style="background-color: ${categoryColor}">${task.folder}</span>
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
                        <div class="reorder-btns" onclick="event.stopPropagation()">
                            <button class="btn-reorder" onclick="app.moveItem('task', ${globalIndex}, -1)" title="위로">
                                <i class="fas fa-chevron-up"></i>
                            </button>
                            <button class="btn-reorder" onclick="app.moveItem('task', ${globalIndex}, 1)" title="아래로">
                                <i class="fas fa-chevron-down"></i>
                            </button>
                        </div>
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
            if (task.completed) {
                task.completedAt = new Date().toISOString();
            } else {
                delete task.completedAt;
            }
            await this.saveData();
            this.renderTasks();
        }
    },

    initCharts() {
        const trendCtx = document.getElementById('weeklyTrendChart');
        if (!trendCtx) return;
        this.charts.weeklyTrend = new Chart(trendCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '완료 업무 수',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: { color: document.body.dataset.theme === 'dark' ? '#f8fafc' : '#1e293b' },
                        grid: { color: document.body.dataset.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0, color: document.body.dataset.theme === 'dark' ? '#f8fafc' : '#1e293b' },
                        grid: { color: document.body.dataset.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                    }
                }
            }
        });

        const distCtx = document.getElementById('categoryDistChart');
        if (!distCtx) return;
        this.charts.categoryDist = new Chart(distCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            font: { size: 11 },
                            color: document.body.dataset.theme === 'dark' ? '#f8fafc' : '#1e293b'
                        }
                    }
                },
                cutout: '70%',
                animation: { animateScale: true, animateRotate: true }
            }
        });
    },

    updateCharts(tasks) {
        if (!this.charts.weeklyTrend || !this.charts.categoryDist) return;

        const statType = this.data.statFilter;
        const trendTitle = document.getElementById('trendChartTitle');
        const distTitle = document.getElementById('distChartTitle');

        const statusMap = { all: '전체', active: '진행 중', urgent: '마감 임박', completed: '완료' };
        if (distTitle) distTitle.textContent = `${statusMap[statType]} 업무 카테고리 분포`;

        const targetType = (statType === 'all' || statType === 'completed') ? 'line' : 'bar';

        if (this.charts.weeklyTrend.config.type !== targetType) {
            this.charts.weeklyTrend.destroy();
            const trendCtx = document.getElementById('weeklyTrendChart').getContext('2d');
            this.charts.weeklyTrend = new Chart(trendCtx, {
                type: targetType,
                data: {
                    labels: [],
                    datasets: [{
                        label: targetType === 'line' ? '완료 수' : '업무 수',
                        data: [],
                        borderColor: '#6366f1',
                        backgroundColor: targetType === 'line' ? 'rgba(99, 102, 241, 0.1)' : '#6366f1',
                        fill: targetType === 'line',
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#6366f1',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            ticks: { color: document.body.dataset.theme === 'dark' ? '#f8fafc' : '#1e293b' },
                            grid: { color: document.body.dataset.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1, precision: 0, color: document.body.dataset.theme === 'dark' ? '#f8fafc' : '#1e293b' },
                            grid: { color: document.body.dataset.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });
        }

        if (targetType === 'line') {
            if (trendTitle) trendTitle.textContent = '주간 활동 트렌드 (최근 7일)';
            const last7Days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                last7Days.push(d.toISOString().split('T')[0]);
            }
            const counts = last7Days.map(date => tasks.filter(t => t.completed && t.completedAt && t.completedAt.split('T')[0] === date).length);
            this.charts.weeklyTrend.data.labels = last7Days.map(d => d.split('-').slice(1).join('/'));
            this.charts.weeklyTrend.data.datasets[0].label = '완료 수';
            this.charts.weeklyTrend.data.datasets[0].data = counts;
        } else {
            if (trendTitle) trendTitle.textContent = `${statusMap[statType]} 업무 일자별 현황`;
            const dateCounts = {};
            tasks.forEach(t => {
                const date = t.endDate || t.startDate;
                if (date) dateCounts[date] = (dateCounts[date] || 0) + 1;
            });
            const sortedDates = Object.keys(dateCounts).sort().slice(0, 7);
            this.charts.weeklyTrend.data.labels = sortedDates.map(d => d.split('-').slice(1).join('/'));
            this.charts.weeklyTrend.data.datasets[0].label = '업무 수';
            this.charts.weeklyTrend.data.datasets[0].data = sortedDates.map(d => dateCounts[d]);
        }
        this.charts.weeklyTrend.update();

        const categoryData = {};
        tasks.forEach(task => { categoryData[task.folder] = (categoryData[task.folder] || 0) + 1; });
        const labels = Object.keys(categoryData);
        const bgColors = labels.map(name => {
            const folder = this.data.folders.find(f => f.name === name);
            return folder ? folder.color : '#6366f1';
        });
        this.charts.categoryDist.data.labels = labels;
        this.charts.categoryDist.data.datasets[0].data = Object.values(categoryData);
        this.charts.categoryDist.data.datasets[0].backgroundColor = bgColors;
        this.charts.categoryDist.update();
    },

    updateDashboardWidgets(tasks) {
        const urgentListElem = document.getElementById('urgentSummaryList');
        const activeTasks = tasks.filter(t => !t.completed);
        const urgentTop5 = activeTasks.sort((a, b) => new Date(a.endDate) - new Date(b.endDate)).slice(0, 5);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (urgentListElem) {
            urgentListElem.innerHTML = urgentTop5.map(task => {
                const end = new Date(task.endDate);
                const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
                const ddayLabel = diff === 0 ? 'D-Day' : (diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`);
                return `
                    <div class="summary-item">
                        <div class="summary-item-info">
                            <div class="summary-item-title">${task.title}</div>
                            <div class="summary-item-date">
                                <i class="far fa-folder" style="font-size: 0.7rem;"></i> ${task.folder} 
                                <span style="margin: 0 4px; opacity: 0.5;">|</span>
                                <i class="far fa-calendar-alt" style="font-size: 0.7rem;"></i> ~${task.endDate}
                            </div>
                        </div>
                        <span class="dday-badge-small">${ddayLabel}</span>
                    </div>
                `;
            }).join('') || '<div style="text-align: center; color: var(--text-muted); padding: 1rem; font-size: 0.9rem;">마감 임박 업무가 없습니다. ✨</div>';
        }

        const progressListElem = document.getElementById('progressList');
        if (progressListElem) {
            const categoryProgressHtml = this.data.folders.map(folder => {
                const folderTasks = tasks.filter(t => t.folder === folder.name);
                if (folderTasks.length === 0) return '';
                const completed = folderTasks.filter(t => t.completed).length;
                const percent = Math.round((completed / folderTasks.length) * 100);
                return `
                    <div class="progress-item">
                        <div class="progress-item-header">
                            <span class="progress-item-name">
                                <i class="fas fa-circle" style="color: ${folder.color || '#6366f1'}; font-size: 0.6rem; margin-right: 4px;"></i>
                                ${folder.name}
                            </span>
                            <span class="progress-item-percent">${percent}% ${percent === 100 ? '🎉' : ''}</span>
                        </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${percent}%; background: linear-gradient(90deg, ${folder.color || '#6366f1'}, var(--primary-color))"></div>
                        </div>
                    </div>
                `;
            }).join('');
            progressListElem.innerHTML = categoryProgressHtml || '<div style="text-align: center; color: var(--text-muted); padding: 1rem; font-size: 0.9rem;">카테고리 정보가 없습니다.</div>';
        }

        const prioritySummaryElem = document.getElementById('prioritySummary');
        if (prioritySummaryElem) {
            const prioMap = {
                critical: '최우선', urgent: '긴급', high: '높음',
                normal: '보통', low: '낮음', lowest: '최하'
            };
            const prioIcons = {
                critical: '🚨', urgent: '🔥', high: '⚡',
                normal: '⚖️', low: '🧊', lowest: '🍃'
            };
            const prioColors = {
                critical: '#7c3aed', urgent: '#ef4444', high: '#f59e0b',
                normal: '#3b82f6', low: '#64748b', lowest: '#94a3b8'
            };
            // 명시적 순서 정의
            const order = ['critical', 'urgent', 'high', 'normal', 'low', 'lowest'];

            prioritySummaryElem.innerHTML = order.map(prioKey => {
                const count = activeTasks.filter(t => (t.priority || 'normal') === prioKey).length;
                return `
                    <div class="prio-summary-item">
                        <span class="prio-summary-val" style="color: ${prioColors[prioKey]}">${count}</span>
                        <span class="prio-summary-label">${prioIcons[prioKey]} ${prioMap[prioKey]}</span>
                    </div>
                `;
            }).join('');
        }
    },

    toggleSettings(show) {
        const settings = document.getElementById('settingsView');
        if (settings) settings.style.display = show ? 'flex' : 'none';
        if (show) {
            this.switchSettingsTab('category');
            this.renderFolderSettings();
            this.renderMembersInSettings();
            this.renderColorPalette();
        }
        this.updateSidebarUI();
    },

    moveItem(type, index, direction) {
        let array;
        if (type === 'folder') array = this.data.folders;
        else if (type === 'member') array = this.data.members;
        else if (type === 'task') array = this.data.tasks;
        else return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= array.length) return;

        [array[index], array[newIndex]] = [array[newIndex], array[index]];
        this.saveData();

        if (type === 'folder') {
            this.renderFolders();
            this.renderFolderSettings();
            this.updateFolderSelect();
            this.updateFilterOptions();
        } else if (type === 'member') {
            this.renderMembersInSettings();
            this.renderMembers();
            this.updateFilterOptions();
        } else if (type === 'task') {
            this.renderTasks();
        }
    },

    renderColorPalette() {
        const palette = document.getElementById('colorPalette');
        if (!palette) return;
        palette.innerHTML = this.colors.map((color, index) => `
            <div class="color-swatch ${index === 0 ? 'selected' : ''}" 
                 style="background-color: ${color}" 
                 onclick="app.selectColor('${color}', this)"></div>
        `).join('');
        document.getElementById('selectedColor').value = this.colors[0];
    },

    selectColor(color, element) {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        element.classList.add('selected');
        document.getElementById('selectedColor').value = color;
    },

    switchSettingsTab(tabId) {
        document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeTabBtn = document.getElementById(`tab-${tabId}`);
        if (activeTabBtn) activeTabBtn.classList.add('active');

        document.querySelectorAll('.settings-tab-content').forEach(content => content.classList.remove('active'));
        const activeContent = document.getElementById(`settings${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Tab`);
        if (activeContent) activeContent.classList.add('active');
    },

    async handleAddFolder() {
        const input = document.getElementById('newFolderName');
        const name = input.value.trim();
        const parent = document.getElementById('parentFolderSelect').value || null;
        const color = document.getElementById('selectedColor').value;

        if (name && !this.data.folders.find(f => f.name === name)) {
            this.data.folders.push({ name, parent, color });
            await this.saveData();
            this.renderFolders();
            this.renderFolderSettings();
            this.updateFolderSelect();
            this.updateFilterOptions();
            input.value = '';
        } else if (name) {
            alert("이미 존재하는 카테고리 이름입니다.");
        }
    },

    async handleEditFolder(oldName) {
        const folder = this.data.folders.find(f => f.name === oldName);
        if (!folder) return;

        const newName = prompt(`'${oldName}' 카테고리의 새 이름을 입력하세요:`, oldName);
        if (newName && newName.trim() !== "" && newName !== oldName) {
            const trimmedName = newName.trim();
            if (this.data.folders.find(f => f.name === trimmedName)) {
                alert("이미 존재하는 카테고리 이름입니다.");
                return;
            }

            const index = this.data.folders.findIndex(f => f.name === oldName);
            if (index > -1) {
                this.data.folders[index].name = trimmedName;
                // 자식들의 부모 이름 업데이트
                this.data.folders.forEach(f => { if (f.parent === oldName) f.parent = trimmedName; });
                // 업무들의 카테고리 이름 업데이트
                this.data.tasks.forEach(t => { if (t.folder === oldName) t.folder = trimmedName; });

                await this.saveData();
                this.renderFolders();
                this.renderFolderSettings();
                this.updateFolderSelect();
                this.updateFilterOptions();
                this.renderTasks();
            }
        }
    },

    async handleDeleteFolder(folderName) {
        if (confirm(`'${folderName}' 카테고리를 삭제하시겠습니까? (하위 카테고리는 상위로 이동됩니다.)`)) {
            this.data.folders.forEach(f => { if (f.parent === folderName) f.parent = null; });
            this.data.folders = this.data.folders.filter(f => f.name !== folderName);
            await this.saveData();
            this.renderFolders();
            this.renderFolderSettings();
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
        } else if (name) {
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
                this.data.tasks.forEach(t => {
                    const mIndex = t.members.indexOf(oldName);
                    if (mIndex > -1) t.members[mIndex] = trimmedName;
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
                    alert("데이터를 성공적으로 불러왔습니다.");
                }
            } catch (err) { alert("유효하지 않은 파일 형식입니다."); }
        };
        reader.readAsText(file);
    },

    syncWithECount(task) { console.log("Syncing with E-Count API...", task); }
};

document.addEventListener('DOMContentLoaded', () => app.init());

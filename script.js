document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const taskInput = document.getElementById('taskInput');
    const categorySelect = document.getElementById('categorySelect');
    const estimateTime = document.getElementById('estimateTime');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const totalTasksSpan = document.getElementById('totalTasks');
    const completionRateSpan = document.getElementById('completionRate');
    const totalTimeSpan = document.getElementById('totalTime');
    
    // 图表元素
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    const timeCtx = document.getElementById('timeChart').getContext('2d');
    
    // 初始化数据
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let activeFilter = 'all';
    let timers = {};
    
    // 初始化图表
    let categoryChart = createCategoryChart();
    let timeChart = createTimeChart();
    
    // 渲染任务列表
    renderTasks();
    updateSummary();
    updateCharts();
    
    // 事件监听
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addTask();
    });
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeFilter = this.dataset.filter;
            renderTasks();
        });
    });
    
    // 添加任务
    function addTask() {
        const text = taskInput.value.trim();
        const category = categorySelect.value;
        const time = parseInt(estimateTime.value) || 0;
        
        if (text) {
            tasks.push({
                id: Date.now(),
                text,
                category,
                estimatedTime: time,
                timeSpent: 0,
                completed: false,
                createdAt: new Date().toISOString(),
                completedAt: null
            });
            
            saveTasks();
            taskInput.value = '';
            estimateTime.value = '';
            renderTasks();
            updateSummary();
            updateCharts();
        }
    }
    
    // 渲染任务列表
    function renderTasks() {
        taskList.innerHTML = '';
        
        const filteredTasks = tasks.filter(task => {
            if (activeFilter === 'all') return true;
            return task.category === activeFilter;
        });
        
        if (filteredTasks.length === 0) {
            taskList.innerHTML = '<p class="no-tasks">没有找到任务</p>';
            return;
        }
        
        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.category} ${task.completed ? 'completed' : ''}`;
            
            const timeSpentFormatted = formatTime(task.timeSpent);
            const estimatedTimeFormatted = formatTime(task.estimatedTime * 60);
            
            li.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                <div class="task-content">
                    <div class="task-title">${task.text}</div>
                    <div class="task-meta">
                        <span class="task-category ${task.category}">${getCategoryName(task.category)}</span>
                        <span class="task-time">预计: ${estimatedTimeFormatted} | 实际: ${timeSpentFormatted}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-btn start-btn" data-id="${task.id}">开始</button>
                    <button class="task-btn stop-btn" data-id="${task.id}">停止</button>
                    <button class="task-btn delete-btn" data-id="${task.id}">删除</button>
                </div>
            `;
            
            taskList.appendChild(li);
        });
        
        // 添加事件监听
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', toggleTask);
        });
        
        document.querySelectorAll('.start-btn').forEach(btn => {
            btn.addEventListener('click', startTimer);
        });
        
        document.querySelectorAll('.stop-btn').forEach(btn => {
            btn.addEventListener('click', stopTimer);
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', deleteTask);
        });
    }
    
    // 切换任务状态
    function toggleTask(e) {
        const taskId = parseInt(e.target.dataset.id);
        const task = tasks.find(t => t.id === taskId);
        
        if (task) {
            task.completed = e.target.checked;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            
            // 如果任务完成，停止计时器
            if (task.completed && timers[taskId]) {
                clearInterval(timers[taskId]);
                delete timers[taskId];
                
                const startBtn = document.querySelector(`.start-btn[data-id="${taskId}"]`);
                const stopBtn = document.querySelector(`.stop-btn[data-id="${taskId}"]`);
                
                if (startBtn && stopBtn) {
                    startBtn.style.display = 'block';
                    stopBtn.style.display = 'none';
                }
            }
            
            saveTasks();
            updateSummary();
            updateCharts();
        }
    }
    
    // 开始计时
    function startTimer(e) {
        const taskId = parseInt(e.target.dataset.id);
        const task = tasks.find(t => t.id === taskId);
        
        if (task && !task.completed) {
            // 隐藏开始按钮，显示停止按钮
            e.target.style.display = 'none';
            const stopBtn = document.querySelector(`.stop-btn[data-id="${taskId}"]`);
            if (stopBtn) stopBtn.style.display = 'block';
            
            // 启动计时器
            const startTime = Date.now();
            
            timers[taskId] = setInterval(() => {
                const currentTime = Date.now();
                const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
                task.timeSpent = (task.timeSpent || 0) + 1;
                
                // 更新显示
                const timeElement = document.querySelector(`.task-item[data-id="${taskId}"] .task-time`);
                if (timeElement) {
                    const estimatedTimeFormatted = formatTime(task.estimatedTime * 60);
                    const timeSpentFormatted = formatTime(task.timeSpent);
                    timeElement.textContent = `预计: ${estimatedTimeFormatted} | 实际: ${timeSpentFormatted}`;
                }
                
                // 每60秒保存一次
                if (elapsedSeconds % 60 === 0) {
                    saveTasks();
                    updateSummary();
                }
            }, 1000);
        }
    }
    
    // 停止计时
    function stopTimer(e) {
        const taskId = parseInt(e.target.dataset.id);
        
        if (timers[taskId]) {
            clearInterval(timers[taskId]);
            delete timers[taskId];
            
            // 隐藏停止按钮，显示开始按钮
            e.target.style.display = 'none';
            const startBtn = document.querySelector(`.start-btn[data-id="${taskId}"]`);
            if (startBtn) startBtn.style.display = 'block';
            
            saveTasks();
            updateSummary();
        }
    }
    
    // 删除任务
    function deleteTask(e) {
        const taskId = parseInt(e.target.dataset.id);
        
        // 停止计时器如果正在运行
        if (timers[taskId]) {
            clearInterval(timers[taskId]);
            delete timers[taskId];
        }
        
        tasks = tasks.filter(task => task.id !== taskId);
        saveTasks();
        renderTasks();
        updateSummary();
        updateCharts();
    }
    
    // 保存任务到本地存储
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
    
    // 更新摘要信息
    function updateSummary() {
        const total = tasks.length;
        const completed = tasks.filter(task => task.completed).length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const totalTimeSpent = tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
        
        totalTasksSpan.textContent = total;
        completionRateSpan.textContent = `${completionRate}%`;
        totalTimeSpan.textContent = formatTime(totalTimeSpent);
    }
    
    // 更新图表
    function updateCharts() {
        // 按类别统计
        const categories = ['work', 'study', 'personal'];
        const categoryData = categories.map(cat => {
            return tasks.filter(task => task.category === cat).length;
        });
        
        // 按时间统计（已完成任务）
        const completedTasks = tasks.filter(task => task.completed);
        const timeData = [0, 0, 0, 0]; // <15min, 15-30min, 30-60min, >60min
        
        completedTasks.forEach(task => {
            const minutes = Math.floor(task.timeSpent / 60);
            
            if (minutes < 15) timeData[0]++;
            else if (minutes < 30) timeData[1]++;
            else if (minutes < 60) timeData[2]++;
            else timeData[3]++;
        });
        
        // 更新图表数据
        categoryChart.data.datasets[0].data = categoryData;
        timeChart.data.datasets[0].data = timeData;
        
        categoryChart.update();
        timeChart.update();
    }
    
    // 创建类别图表
    function createCategoryChart() {
        return new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: ['工作', '学习', '个人'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(74, 107, 175, 0.7)',
                        'rgba(76, 175, 80, 0.7)',
                        'rgba(156, 39, 176, 0.7)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: '任务类别分布',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // 创建时间图表
    function createTimeChart() {
        return new Chart(timeCtx, {
            type: 'bar',
            data: {
                labels: ['<15分钟', '15-30分钟', '30-60分钟', '>60分钟'],
                datasets: [{
                    label: '任务数量',
                    data: [0, 0, 0, 0],
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: '任务耗时分布',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }
    
    // 辅助函数：格式化时间
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        if (mins > 0) {
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        return `${secs}s`;
    }
    
    // 辅助函数：获取类别名称
    function getCategoryName(category) {
        const names = {
            work: '工作',
            study: '学习',
            personal: '个人'
        };
        return names[category] || category;
    }
});
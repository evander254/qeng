import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownUp, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, CircleAlert, Clock3, GraduationCap, LayoutDashboard, ListFilter, Moon, Search, SlidersHorizontal, Sun, Users, X } from 'lucide-react'
import assignments from './data/assignments.json'
import { supabase } from './lib/supabase'

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const formatDate = (value) => value ? dateFormat.format(new Date(`${value}T12:00:00`)) : 'No due date'
const shortCourse = (course) => course?.split(' (')[0] || 'Class assignment'
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const timeGreeting = () => { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening' }
const offsetDateKey = (days) => { const now = new Date(); return localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)) }

function Dashboard({ user, profile, onSignOut }) {
  const [prefs] = useState(() => { try { return JSON.parse(localStorage.getItem(`voski.preferences.${user.id}`) || '{}') } catch { return {} } })
  const [query, setQuery] = useState(prefs.query || '')
  const [priority, setPriority] = useState(prefs.priority || 'All priorities')
  const [student, setStudent] = useState(prefs.student || 'All students')
  const [classFilter, setClassFilter] = useState(prefs.classFilter || 'All classes')
  const [assignmentFilter, setAssignmentFilter] = useState(prefs.assignmentFilter || 'All assignments')
  const [currentPage, setCurrentPage] = useState(prefs.currentPage || 1)
  const [view, setView] = useState(prefs.view || 'Overview')
  const [sortOrder, setSortOrder] = useState(prefs.sortOrder || 'asc')
  const [notice, setNotice] = useState('')
  const [records, setRecords] = useState([])
  const [people, setPeople] = useState([])
  const [adminMode, setAdminMode] = useState(prefs.adminMode === true && profile?.role === 'admin')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ student: '', course: '', classEndDate: '', task: '', due: '', hours: '1', priority: 'UPCOMING', owner: '' })
  const [overviewPanel, setOverviewPanel] = useState(prefs.overviewPanel || 'home')
  const [darkMode, setDarkMode] = useState(prefs.darkMode === true)
  const [navigationStack, setNavigationStack] = useState(() => { try { return JSON.parse(sessionStorage.getItem(`voski.history.${user.id}`) || '[]') } catch { return [] } })
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [selectedDueDate, setSelectedDueDate] = useState(prefs.selectedDueDate || localDateKey())
  const [updatingId, setUpdatingId] = useState('')

  const currentScreen = () => ({ view, overviewPanel, classFilter, student, assignmentFilter, query, currentPage, sortOrder, adminMode, selectedStudent, selectedAssignment, selectedDueDate })
  const restoreScreen = (screen) => {
    if (!screen) return
    setView(screen.view || 'Overview'); setOverviewPanel(screen.overviewPanel || 'home'); setClassFilter(screen.classFilter || 'All classes'); setStudent(screen.student || 'All students'); setAssignmentFilter(screen.assignmentFilter || 'All assignments'); setQuery(screen.query || ''); setCurrentPage(screen.currentPage || 1); setSortOrder(screen.sortOrder || 'asc'); setAdminMode(screen.adminMode === true && profile?.role === 'admin'); setSelectedStudent(screen.selectedStudent || ''); setSelectedAssignment(screen.selectedAssignment || null); setSelectedDueDate(screen.selectedDueDate || localDateKey())
  }
  const navigateScreen = (next) => {
    setNavigationStack((stack) => [...stack.slice(-19), currentScreen()])
    restoreScreen({ ...currentScreen(), ...next })
  }
  const goBack = () => {
    if (!navigationStack.length) return
    const previous = navigationStack[navigationStack.length - 1]
    setNavigationStack((stack) => stack.slice(0, -1))
    restoreScreen(previous)
  }
  useEffect(() => {
    const saved = { view, overviewPanel, classFilter, student, assignmentFilter, query, currentPage, sortOrder, adminMode, darkMode, selectedDueDate }
    localStorage.setItem(`voski.preferences.${user.id}`, JSON.stringify(saved))
    sessionStorage.setItem(`voski.history.${user.id}`, JSON.stringify(navigationStack))
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [user.id, view, overviewPanel, classFilter, student, assignmentFilter, query, currentPage, sortOrder, adminMode, darkMode, selectedDueDate, navigationStack])

  const reload = async () => {
    if (!supabase) return
    const [{ data, error }, { data: users }] = await Promise.all([
      supabase.from('assignments').select('id,task,due_date,status,estimated_hours,priority,students(name),classes(name,course_code,end_date)').order('due_date', { ascending: true, nullsFirst: false }),
      profile?.role === 'admin' ? supabase.from('profiles').select('id,username,email,role,approved_at,created_at').order('created_at') : Promise.resolve({ data: [] }),
    ])
    if (error) { setNotice(error.message); return }
    setRecords((data || []).map((row) => ({ id: row.id, Student: row.students?.name || 'Student', Course: row.classes?.name || 'Class', CourseEndDate: row.classes?.end_date || '', Task: row.task, Due: row.due_date || '', Status: row.status, Hours: row.estimated_hours, Priority: row.priority })))
    setPeople(users || [])
  }
  useEffect(() => { reload() }, [user?.id, profile?.role])

  const data = supabase ? records : assignments
  const students = useMemo(() => [...new Set(data.map((item) => item.Student))].sort(), [data])
  const classOptions = useMemo(() => [...new Set(data.map((item) => item.Course))].sort(), [data])
  const dueToday = data.filter((item) => item.Due === localDateKey())
  const dueSoonDays = Array.from({ length: 7 }, (_, index) => {
    const key = offsetDateKey(index)
    return { key, date: new Date(`${key}T12:00:00`), assignments: data.filter((item) => item.Due === key) }
  })
  const selectedDayAssignments = data.filter((item) => item.Due === selectedDueDate).sort((a, b) => a.Task.localeCompare(b.Task))
  const classCards = classOptions.map((course) => {
    const work = data.filter((item) => item.Course === course)
    return { name: course, work, done: work.filter((item) => item.Status === 'Completed').length, students: [...new Set(work.map((item) => item.Student))].sort(), endDate: work.find((item) => item.CourseEndDate)?.CourseEndDate || '' }
  })
  const studentCards = students.map((name) => {
    const work = data.filter((item) => item.Student === name)
    return { name, work, classes: [...new Set(work.map((item) => item.Course))] }
  })
  const overdue = data.filter((item) => item.Due && item.Due < localDateKey() && item.Status !== 'Completed').length
  const urgent = data.filter((item) => item.Due && item.Due >= localDateKey() && item.Due <= localDateKey(new Date(Date.now() + 7 * 86400000)) && item.Status !== 'Completed').length
  const classCount = classOptions.length

  const filtered = useMemo(() => data.filter((item) => {
    const searchMatch = Object.values(item).join(' ').toLowerCase().includes(query.toLowerCase())
    const priorityMatch = priority === 'All priorities' || item.Priority === priority
    const studentMatch = student === 'All students' || item.Student === student
    const classMatch = classFilter === 'All classes' || item.Course === classFilter
    const category = assignmentFilter !== 'All assignments' ? assignmentFilter : view === 'Overdue' ? 'Overdue' : view === 'Due soon' ? 'Upcoming' : 'All assignments'
    const today = localDateKey()
    const isCompleted = item.Status === 'Completed'
    const categoryMatch = category === 'All assignments' || (category === 'Overdue' ? Boolean(item.Due && item.Due < today && !isCompleted) : category === 'Upcoming' ? Boolean(item.Due && item.Due > today && !isCompleted) : category === 'Due today' ? item.Due === today : category === 'Completed' ? isCompleted : true)
    return searchMatch && priorityMatch && studentMatch && classMatch && categoryMatch
  }).sort((a, b) => {
    if (!a.Due && !b.Due) return a.Task.localeCompare(b.Task)
    if (!a.Due) return 1
    if (!b.Due) return -1
    const dateCompare = sortOrder === 'asc' ? a.Due.localeCompare(b.Due) : b.Due.localeCompare(a.Due)
    return dateCompare || a.Task.localeCompare(b.Task)
  }), [data, query, priority, student, classFilter, assignmentFilter, view, sortOrder])
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  useEffect(() => { setCurrentPage((page) => Math.min(page, pageCount)) }, [pageCount])

  const addAssignment = async (event) => {
    event.preventDefault(); setBusy(true)
    const { data: studentRow, error: studentError } = await supabase.from('students').upsert({ owner_id: form.owner, name: form.student.trim() }, { onConflict: 'owner_id,name' }).select('id').single()
    if (studentError) { setNotice(studentError.message); setBusy(false); return }
    const { data: classRow, error: classError } = await supabase.from('classes').upsert({ owner_id: form.owner, name: form.course.trim(), ...(form.classEndDate ? { end_date: form.classEndDate } : {}) }, { onConflict: 'owner_id,name' }).select('id').single()
    if (classError) { setNotice(classError.message); setBusy(false); return }
    const { error } = await supabase.from('assignments').insert({ owner_id: form.owner, student_id: studentRow.id, class_id: classRow.id, task: form.task.trim(), due_date: form.due || null, estimated_hours: Number(form.hours) || 0, priority: form.priority, status: 'Unfinished' })
    setBusy(false)
    if (error) setNotice(error.message); else { setNotice('Assignment added.'); setForm({ student: '', course: '', classEndDate: '', task: '', due: '', hours: '1', priority: 'UPCOMING', owner: '' }); reload() }
  }
  const approve = async (id) => { const { error } = await supabase.from('profiles').update({ approved_at: new Date().toISOString() }).eq('id', id); setNotice(error ? error.message : 'User approved.'); reload() }

  const clearFilters = () => { setQuery(''); setPriority('All priorities'); setStudent('All students'); setClassFilter('All classes'); setAssignmentFilter('All assignments'); setView('All assignments'); setCurrentPage(1) }
  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'All assignments', icon: BookOpen },
    { label: 'Due soon', icon: CalendarDays, count: urgent },
    { label: 'Overdue', icon: CircleAlert, count: overdue },
  ]
  const studentAssignments = selectedStudent ? data.filter((item) => item.Student === selectedStudent) : []
  const studentCompleted = studentAssignments.filter((item) => item.Status === 'Completed').length
  const updateProgress = async (item) => {
    if (!item.id || updatingId) return false
    const nextStatus = item.Status === 'Completed' ? 'Unfinished' : 'Completed'
    setUpdatingId(item.id)
    setRecords((current) => current.map((record) => record.id === item.id ? { ...record, Status: nextStatus } : record))
    const { error } = await supabase.from('assignments').update({ status: nextStatus }).eq('id', item.id)
    if (error) { setNotice(`Could not save progress: ${error.message}`); await reload() }
    else setNotice(nextStatus === 'Completed' ? 'Assignment marked complete.' : 'Assignment moved back to in progress.')
    setUpdatingId('')
    return !error
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top" aria-label="VOSKI home"><span className="brand-mark"><GraduationCap size={21} /></span><span>voski<span className="brand-period">.</span></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <div className="workspace-switch"><span className="workspace-avatar">A</span><span className="workspace-name">Class workspace<small>Fall 2026</small></span><ChevronDown size={16} /></div>
      <div className="nav-label">MANAGE</div>
      <nav className="nav-list" aria-label="Main navigation">{navItems.map(({ label, icon: Icon, count }) => <button key={label} onClick={() => navigateScreen({ view: label, overviewPanel: label === 'Overview' ? 'home' : overviewPanel, adminMode: false, ...(label === 'Overdue' ? { assignmentFilter: 'Overdue' } : label === 'Due soon' || label === 'All assignments' ? { assignmentFilter: 'All assignments' } : {}) })} className={`nav-link ${view === label ? 'active' : ''}`}><Icon size={18} /><span>{label}</span>{count > 0 && <span className="nav-count">{count}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><Activity size={17} /></span><strong>Keep your classes on track</strong><p>Review upcoming work and follow up before deadlines.</p></div><div className="profile"><div className="profile-avatar">{(profile?.username || user.email || 'U').slice(0,2).toUpperCase()}</div><div className="profile-copy"><strong>{profile?.username || user.email}</strong><span>{profile?.role === 'admin' ? 'Administrator' : 'Member'}</span></div><button className="icon-button profile-more" aria-label="Sign out" title="Sign out" onClick={onSignOut}><SlidersHorizontal size={17} /></button></div></div>
    </aside>

    <main id="top" className="main-content">
      <header className="topbar"><div className="topbar-leading">{navigationStack.length > 0 && <button className="top-back-button" onClick={goBack} aria-label="Go back"><ArrowLeft size={16}/><span>Back</span></button>}<div className="breadcrumb">Workspace <span>/</span> <strong>{adminMode ? 'Admin' : view === 'Overview' ? overviewPanel === 'home' ? 'Overview' : overviewPanel : view}</strong></div></div><div className="topbar-actions"><span className="today-label"><CalendarDays size={16} /> {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><button className="icon-button theme-toggle" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDarkMode((mode) => !mode)}>{darkMode ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice("You are all caught up on notifications.")}><Bell size={18} /><i /></button><div className="top-avatar">{(profile?.username || user.email || 'U').slice(0,2).toUpperCase()}</div></div></header>
      <div className="page-wrap">
        {view === 'Overview' && !adminMode ? <section className="welcome-row overview-welcome"><div><div className="eyebrow"><span className="live-dot" /> YOUR DAILY CLASSROOM BRIEFING</div><h1>{timeGreeting()}, {profile?.username || 'there'} <span className="wave">!</span></h1><p className="page-subtitle">Here's what's on your schedule today.</p></div><span className="overview-date"><CalendarDays size={16}/>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span></section> : <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot" /> YOUR CLASSROOM, AT A GLANCE</div><h1>Welcome back, {profile?.username || 'there'} <span className="wave">*</span></h1><p className="page-subtitle">Here's what's happening across your classes this week.</p></div><button className="date-control" onClick={() => setNotice('Showing assignments for Fall semester 2026.')}><CalendarDays size={17} /> Fall semester <ChevronDown size={15} /></button></section>}

        {profile?.role === 'admin' && <div className="admin-toggle"><button className={!adminMode ? 'selected' : ''} onClick={() => navigateScreen({ adminMode: false })}>Dashboard</button><button className={adminMode ? 'selected' : ''} onClick={() => navigateScreen({ adminMode: true })}>Admin console</button></div>}
        {adminMode ? <section className="admin-panel"><h2>Admin console</h2><p>Approve new accounts and assign class work to a user. Users only see data assigned to their account.</p><h3>Pending approvals</h3>{people.filter((person) => !person.approved_at && person.role !== 'admin').map((person) => <div className="admin-person" key={person.id}><span><strong>{person.username}</strong><small>{person.email}</small></span><button onClick={() => approve(person.id)}>Approve access</button></div>)}{!people.some((person) => !person.approved_at && person.role !== 'admin') && <p>No pending users.</p>}<h3>Assign an assignment</h3><form className="admin-form" onSubmit={addAssignment}><select required value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}><option value="">Choose approved user</option>{people.filter((person) => person.approved_at).map((person) => <option value={person.id} key={person.id}>{person.username}  |  {person.email}</option>)}</select><input required placeholder="Student name" value={form.student} onChange={(event) => setForm({ ...form, student: event.target.value })}/><input required placeholder="Class name" value={form.course} onChange={(event) => setForm({ ...form, course: event.target.value })}/><label className="admin-date-field"><span>Class end date (optional)</span><input type="date" value={form.classEndDate} onChange={(event) => setForm({ ...form, classEndDate: event.target.value })}/></label><input required placeholder="Assignment title" value={form.task} onChange={(event) => setForm({ ...form, task: event.target.value })}/><input type="date" aria-label="Assignment due date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })}/><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>UPCOMING</option><option>URGENT</option><option>OVERDUE</option></select><input type="number" step="0.25" min="0" placeholder="Hours" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })}/><button disabled={busy}> {busy ? 'Adding...' : 'Add assignment'}</button></form></section> : view === 'Overview' ? <>
          {overviewPanel === 'home' ? <section className="overview-counts" aria-label="Your classes and students"><button className="overview-count-card" onClick={() => navigateScreen({ overviewPanel: 'classes' })}><span className="stat-icon violet"><BookOpen size={19}/></span><div><strong>{classCount}</strong><span>{classCount === 1 ? 'class' : 'classes'} you're handling</span></div><ChevronRight className="overview-card-chevron" size={17}/></button><button className="overview-count-card" onClick={() => navigateScreen({ overviewPanel: 'students' })}><span className="stat-icon blue"><Users size={19}/></span><div><strong>{students.length}</strong><span>{students.length === 1 ? 'student' : 'students'} in your classes</span></div><ChevronRight className="overview-card-chevron" size={17}/></button></section> : <section className="overview-directory"><div className="directory-heading"><button onClick={goBack}><ArrowLeft size={15}/> Overview</button><div><div className="section-kicker">YOUR WORKSPACE</div><h2>{overviewPanel === 'classes' ? 'Your classes' : 'Your students'}</h2><p>{overviewPanel === 'classes' ? `${classCards.length} classes  |  progress and class end dates` : `${studentCards.length} students  |  click a student to view their work`}</p></div></div>{overviewPanel === 'classes' ? <div className="directory-grid">{classCards.map((item) => { const percent = item.work.length ? Math.round(item.done / item.work.length * 100) : 0; return <button key={item.name} className="directory-card class-directory-card" onClick={() => navigateScreen({ classFilter: item.name, student: 'All students', query: '', view: 'All assignments', assignmentFilter: 'All assignments', overviewPanel: 'home', currentPage: 1 })}><div className="directory-card-top"><span className="directory-card-icon violet"><BookOpen size={17}/></span><span className="directory-card-assignments">{item.work.length} {item.work.length === 1 ? 'assignment' : 'assignments'}</span></div><strong className="directory-card-title">{shortCourse(item.name)}</strong><span className="directory-course-code">{item.name.match(/\(([^)]+)\)/)?.[1] || 'Class workspace'}</span><div className="class-progress-meta"><span>Completion</span><strong>{percent}%</strong></div><div className="class-progress-track"><span style={{ width: `${percent}%` }}/></div><div className="directory-card-bottom"><span><Users size={13}/>{item.students.length} {item.students.length === 1 ? 'student' : 'students'}</span><span><CalendarDays size={13}/>{item.endDate ? `Ends ${formatDate(item.endDate)}` : 'End date not set'}</span></div><span className="class-card-action">View assignments <ChevronRight size={13}/></span></button> })}{!classCards.length && <div className="directory-empty">No classes have been assigned to your account yet.</div>}</div> : <div className="directory-grid student-directory-grid">{studentCards.map((item, index) => { const done = item.work.filter((work) => work.Status === 'Completed').length; return <button key={item.name} className="directory-card student-directory-card" onClick={() => navigateScreen({ selectedStudent: item.name })}><div className="directory-card-top"><span className="student-badge" style={{ '--avatar-hue': (item.name.charCodeAt(0) * 7) % 360 }}>{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="directory-student-index">STUDENT {String(index + 1).padStart(2, '0')}</span></div><strong className="directory-card-title">{item.name}</strong><span className="directory-card-bottom student-card-metrics"><span><BookOpen size={13}/>{item.classes.length} {item.classes.length === 1 ? 'class' : 'classes'}</span><span><CheckCircle2 size={13}/>{done} / {item.work.length} complete</span></span><span className="class-card-action">View student overview <ChevronRight size={13}/></span></button> })}{!studentCards.length && <div className="directory-empty">No students have been assigned to your account yet.</div>}</div>}</section>}
          <section className="today-section"><div className="section-heading"><div><div className="section-kicker">YOUR SCHEDULE</div><h2>Due today <span className="today-count">{dueToday.length}</span></h2><p>{dueToday.length ? 'A quick look at the work scheduled for today.' : 'You are all clear for today. Nice work!'}</p></div><button className="text-link" onClick={() => navigateScreen({ view: 'All assignments', assignmentFilter: 'All assignments' })}>All assignments <ChevronRight size={15}/></button></div>
            {dueToday.length ? <div className="today-list">{dueToday.map((item) => <article className={`today-item ${item.Status === 'Completed' ? 'is-complete' : ''}`} key={item.id || `${item.Student}-${item.Task}`}><button className={`complete-toggle ${item.Status === 'Completed' ? 'checked' : ''}`} aria-label={item.Status === 'Completed' ? `Mark ${item.Task} incomplete` : `Mark ${item.Task} complete`} disabled={updatingId === item.id} onClick={() => updateProgress(item)}>{item.Status === 'Completed' ? <CheckCircle2 size={20}/> : <Circle size={20}/>}</button><div className="today-item-copy"><button className="task-title task-open" onClick={() => navigateScreen({ selectedAssignment: item })}>{item.Task}</button><span><BookOpen size={13}/>{shortCourse(item.Course)}<span className="today-divider"> | </span><button className="today-student-link" onClick={() => navigateScreen({ selectedStudent: item.Student })}>{item.Student}</button></span></div><div className="today-item-end"><span className={`priority-pill ${item.Priority.toLowerCase()}`}><i/>{item.Status === 'Completed' ? 'Completed' : item.Priority === 'OVERDUE' ? 'Overdue' : item.Priority === 'URGENT' ? 'Due soon' : 'Due today'}</span><span className="today-hours">{item.Hours || 0}h</span></div></article>)}</div> : <div className="today-empty"><span className="today-empty-icon"><CheckCircle2 size={23}/></span><strong>No assignments due today</strong><p>Enjoy a little breathing room. Your upcoming work is in All assignments.</p><button onClick={() => navigateScreen({ view: 'All assignments', assignmentFilter: 'All assignments' })}>View all assignments <ChevronRight size={14}/></button></div>}
          </section>
        </> : view === 'Due soon' ? <section className="due-soon-section"><div className="section-heading"><div><div className="section-kicker">THE WEEK AHEAD</div><h2>Coming up</h2><p>Choose a day to see the assignments due then.</p></div><span className="week-range"><CalendarDays size={15}/>{formatDate(offsetDateKey(0))} - {formatDate(offsetDateKey(6))}</span></div><div className="week-cards">{dueSoonDays.map((day, index) => { const complete = day.assignments.filter((item) => item.Status === 'Completed').length; return <button key={day.key} className={`week-day-card ${selectedDueDate === day.key ? 'selected' : ''} ${day.assignments.length ? 'has-work' : ''}`} onClick={() => setSelectedDueDate(day.key)} aria-pressed={selectedDueDate === day.key}><span className="week-day-top"><span>{index === 0 ? 'TODAY' : new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day.date).toUpperCase()}</span>{day.assignments.length > 0 && <i/>}</span><strong className="week-day-number">{new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(day.date)}</strong><span className="week-day-month">{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(day.date)}</span><span className="week-day-count">{day.assignments.length === 1 ? '1 assignment' : `${day.assignments.length} assignments`}</span>{day.assignments.length > 0 && <span className="week-day-complete">{complete} completed</span>}</button> })}</div><div className="due-day-table"><div className="due-day-heading"><div><div className="section-kicker">SELECTED DAY</div><h3>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDueDate}T12:00:00`))}<span>{selectedDayAssignments.length}</span></h3></div><span>{selectedDayAssignments.length ? 'Assignments due' : 'Nothing scheduled'}</span></div>{selectedDayAssignments.length ? <div className="table-scroll"><table className="assignment-table"><thead><tr><th className="check-col">Done</th><th>Assignment</th><th>Class</th><th>Student</th><th>Status</th><th>Effort</th></tr></thead><tbody>{selectedDayAssignments.map((item, index) => <tr key={item.id || `${item.Student}-${item.Task}-${index}`} className={item.Status === 'Completed' ? 'table-row-complete' : ''}><td className="check-col"><button className={`complete-toggle ${item.Status === 'Completed' ? 'checked' : ''}`} aria-label={item.Status === 'Completed' ? `Mark ${item.Task} incomplete` : `Mark ${item.Task} complete`} disabled={updatingId === item.id} onClick={() => updateProgress(item)}>{item.Status === 'Completed' ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button></td><td><button className="table-task-link" onClick={() => navigateScreen({ selectedAssignment: item })}>{item.Task}</button></td><td><span className="table-class-name"><BookOpen size={13}/>{shortCourse(item.Course)}</span></td><td><button className="table-student-link" onClick={() => navigateScreen({ selectedStudent: item.Student })}>{item.Student}<ChevronRight size={12}/></button></td><td><span className={`priority-pill ${item.Status === 'Completed' ? 'completed' : 'upcoming'}`}><i/>{item.Status === 'Completed' ? 'Completed' : 'Due today'}</span></td><td className="table-effort">{item.Hours || 0}h</td></tr>)}</tbody></table></div> : <div className="due-day-empty"><CalendarDays size={19}/><span>No assignments are due on this day.</span></div>}</div></section> : <>
        {view !== 'All assignments' && <section className="stats-grid" aria-label="Class overview">
          <article className="stat-card"><div className="stat-top"><span className="stat-icon violet"><BookOpen size={18} /></span><span className="stat-caption">IN YOUR WORKSPACE</span></div><div className="stat-number">{data.length}</div><div className="stat-foot"><strong>Assignments</strong><span>across all students</span></div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Users size={18} /></span><span className="stat-caption">LEARNING TOGETHER</span></div><div className="stat-number">{students.length}</div><div className="stat-foot"><strong>Students</strong><span>in your classes</span></div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><Clock3 size={18} /></span><span className="stat-caption">NEEDS ATTENTION</span></div><div className="stat-number">{overdue + urgent}<span className="stat-unit"> items</span></div><div className="stat-foot"><strong>Due or overdue</strong><span className="attention-note">{overdue} overdue</span></div></article>
          <article className="stat-card"><div className="stat-top"><span className="stat-icon green"><GraduationCap size={18} /></span><span className="stat-caption">ACTIVE LEARNING</span></div><div className="stat-number">{classCount}</div><div className="stat-foot"><strong>Classes</strong><span>this semester</span></div></article>
        </section>}

        {view !== 'All assignments' && <section className="attention-banner"><span className="attention-symbol"><CircleAlert size={19} /></span><div className="attention-copy"><strong>{overdue} overdue assignments need a follow-up</strong><span>Take a moment to check in with students who may need support.</span></div><button onClick={() => { setView('Overdue'); setAssignmentFilter('Overdue'); setPriority('All priorities') }}>Review overdue <span>{'>'}</span></button></section>}

        <section className="assignments-section"><div className="section-heading"><div><div className="section-kicker">CLASS MANAGEMENT</div><h2>Assignment overview</h2><p>Stay on top of student progress and important deadlines.</p></div><button className="export-button" onClick={() => setNotice('Export is coming soon.')}><ArrowDownUp size={16} /> Export</button></div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Search assignments..." aria-label="Search assignments" />{query && <button aria-label="Clear search" onClick={() => { setQuery(''); setCurrentPage(1) }}><X size={15} /></button>}<kbd>Ctrl K</kbd></label><label className="select-wrap"><BookOpen size={16} /><select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setView('All assignments'); setCurrentPage(1) }} aria-label="Filter by class"><option>All classes</option>{classOptions.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></label><label className="select-wrap student-filter"><Users size={16} /><select value={student} onChange={(event) => { setStudent(event.target.value); setView('All assignments'); setCurrentPage(1) }} aria-label="Filter by student"><option>All students</option>{students.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></label></div>
          <div className="assignment-filter-switch" role="group" aria-label="Filter assignments by date or status">{['All assignments', 'Overdue', 'Upcoming', 'Due today', 'Completed'].map((option) => <button key={option} className={assignmentFilter === option && view === 'All assignments' ? 'active' : ''} onClick={() => { setAssignmentFilter(option); setView('All assignments'); setCurrentPage(1) }}>{option}{option === 'All assignments' && <span>{data.length}</span>}{option === 'Due today' && <span>{dueToday.length}</span>}</button>)}</div>
          <div className="table-shell assignment-table-shell"><div className="table-heading"><div><strong>All assignments</strong><span>{filtered.length} results</span></div><button className="sort-button" onClick={() => setSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}><ArrowDownUp size={14} /> Due date {sortOrder === 'asc' ? '^' : 'v'}</button></div>
            {pageItems.length ? <div className="table-scroll"><table className="assignment-table"><thead><tr><th className="check-col">Done</th><th>Assignment</th><th>Class</th><th>Student</th><th><button onClick={() => setSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}>Due date <ArrowDownUp size={12}/></button></th><th>Status</th><th>Effort</th></tr></thead><tbody>{pageItems.map((item, index) => <tr key={item.id || `${item.Student}-${item.Task}-${index}`} className={item.Status === 'Completed' ? 'table-row-complete' : ''}><td className="check-col"><button className={`complete-toggle ${item.Status === 'Completed' ? 'checked' : ''}`} aria-label={item.Status === 'Completed' ? `Mark ${item.Task} incomplete` : `Mark ${item.Task} complete`} title={item.Status === 'Completed' ? 'Mark incomplete' : 'Mark complete'} disabled={updatingId === item.id} onClick={() => updateProgress(item)}>{item.Status === 'Completed' ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button></td><td><button className="table-task-link" onClick={() => navigateScreen({ selectedAssignment: item })}>{item.Task}</button></td><td><span className="table-class-name"><BookOpen size={13}/>{shortCourse(item.Course)}</span></td><td><button className="table-student-link" onClick={() => navigateScreen({ selectedStudent: item.Student })}>{item.Student}<ChevronRight size={12}/></button></td><td><span className={item.Due && item.Due < localDateKey() && item.Status !== 'Completed' ? 'table-overdue' : 'table-due'}>{formatDate(item.Due)}</span></td><td><span className={`priority-pill ${item.Status === 'Completed' ? 'completed' : item.Due && item.Due < localDateKey() ? 'overdue' : item.Due === localDateKey() ? 'urgent' : 'upcoming'}`}><i/>{item.Status === 'Completed' ? 'Completed' : item.Due && item.Due < localDateKey() ? 'Overdue' : item.Due === localDateKey() ? 'Due today' : 'Upcoming'}</span></td><td className="table-effort">{item.Hours || 0}h</td></tr>)}</tbody></table></div> : <div className="empty-state"><span><Search size={22} /></span><strong>No assignments found</strong><p>Try changing your search or filters.</p><button onClick={clearFilters}>Clear all filters</button></div>}
            <div className="table-footer table-pagination"><span>Showing <strong>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> assignments</span><div className="pagination-controls"><button disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} aria-label="Previous page"><ArrowLeft size={14}/></button><span>Page <strong>{currentPage}</strong> of <strong>{pageCount}</strong></span><button disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} aria-label="Next page"><ArrowRight size={14}/></button></div></div>
          </div>
        </section>
        </>}
        <footer className="page-footer"><span>Copyright 2026 VOSKI Learning</span><span>Built for better learning outcomes <span className="footer-star">*</span></span></footer>
      </div>
      {selectedStudent && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) goBack() }}><section className="detail-dialog student-dialog" role="dialog" aria-modal="true" aria-labelledby="student-title"><button className="dialog-close" onClick={goBack} aria-label="Close student details"><X size={18}/></button><div className="dialog-eyebrow"><Users size={14}/> STUDENT OVERVIEW</div><h2 id="student-title">{selectedStudent}</h2><p className="dialog-subtitle">Assignments and progress across this student's classes.</p><div className="student-classes-summary"><strong>{new Set(studentAssignments.map((item) => item.Course)).size} classes</strong><div>{[...new Set(studentAssignments.map((item) => item.Course))].map((course) => <span key={course}><BookOpen size={12}/>{shortCourse(course)}</span>)}</div></div><div className="student-progress"><div><strong>{studentCompleted}<span> / {studentAssignments.length}</span></strong><small>assignments completed</small></div><div className="progress-track"><span style={{ width: `${studentAssignments.length ? studentCompleted / studentAssignments.length * 100 : 0}%` }}/></div></div><div className="student-work-list">{studentAssignments.map((item) => <article key={item.id || item.Task} className="student-work-item"><button className={`complete-toggle ${item.Status === 'Completed' ? 'checked' : ''}`} onClick={() => updateProgress(item)} disabled={updatingId === item.id} aria-label={`Toggle ${item.Task}`}>{item.Status === 'Completed' ? <CheckCircle2 size={18}/> : <Circle size={18}/>}</button><button className="student-work-copy" onClick={() => navigateScreen({ selectedAssignment: item })}><strong>{item.Task}</strong><span>{shortCourse(item.Course)}  |  {formatDate(item.Due)}</span></button><span className={`priority-pill ${item.Priority.toLowerCase()}`}><i/>{item.Status === 'Completed' ? 'Done' : item.Priority === 'OVERDUE' ? 'Overdue' : item.Priority === 'URGENT' ? 'Due soon' : 'Upcoming'}</span></article>)}</div></section></div>}
      {selectedAssignment && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) goBack() }}><section className="detail-dialog assignment-dialog" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><button className="dialog-close" onClick={goBack} aria-label="Close assignment details"><X size={18}/></button><div className="dialog-eyebrow"><BookOpen size={14}/> ASSIGNMENT DETAILS</div><span className={`priority-pill ${selectedAssignment.Priority.toLowerCase()}`}><i/>{selectedAssignment.Priority === 'OVERDUE' ? 'Overdue' : selectedAssignment.Priority === 'URGENT' ? 'Due soon' : 'Upcoming'}</span><h2 id="assignment-title">{selectedAssignment.Task}</h2><p className="dialog-subtitle">{shortCourse(selectedAssignment.Course)}</p><div className="detail-facts"><div><small>STUDENT</small><button onClick={() => navigateScreen({ selectedAssignment: null, selectedStudent: selectedAssignment.Student })}>{selectedAssignment.Student}<ChevronRight size={14}/></button></div><div><small>DUE DATE</small><strong>{formatDate(selectedAssignment.Due)}</strong></div><div><small>ESTIMATED TIME</small><strong>{selectedAssignment.Hours || 0} hours</strong></div><div><small>STATUS</small><strong>{selectedAssignment.Status}</strong></div></div><button className={`mark-complete-button ${selectedAssignment.Status === 'Completed' ? 'done' : ''}`} onClick={async () => { if (await updateProgress(selectedAssignment)) setSelectedAssignment((current) => current ? { ...current, Status: current.Status === 'Completed' ? 'Unfinished' : 'Completed' } : null) }}>{selectedAssignment.Status === 'Completed' ? <><CheckCircle2 size={17}/> Mark as in progress</> : <><Check size={17}/> Mark assignment complete</>}</button></section></div>}
      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </main>
  </div>
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setMessage('')
    let result
    if (mode === 'login') {
      let loginEmail = email.trim()
      if (!loginEmail.includes('@')) {
        const { data, error } = await supabase.rpc('lookup_login_email', { username_input: loginEmail })
        if (error || !data) {
          setLoading(false)
          setMessage('Unable to sign in with those details. Check your username and password, or try your email address.')
          return
        }
        loginEmail = data
      }
      result = await supabase.auth.signInWithPassword({ email: loginEmail, password })
    } else {
      result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { username: username.trim() } } })
    }
    setLoading(false)
    setMessage(result.error?.message || (mode === 'register' ? 'Registration received. Your account will be available after an administrator approves it.' : 'Signed in.'))
  }
  return <main className="auth-page"><section className="auth-card"><a className="brand auth-brand" href="#"><span className="brand-mark"><GraduationCap size={21}/></span><span>voski<span className="brand-period">.</span></span></a><div className="auth-kicker">YOUR CLASSROOM, IN ONE PLACE</div><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1><p>Sign in to access your classes and assignment details.</p><form onSubmit={submit}>{mode === 'register' && <label>Username<input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Your name"/></label>}<label>{mode === 'login' ? 'Username or email' : 'Email address'}<input required type={mode === 'login' ? 'text' : 'email'} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete={mode === 'login' ? 'username' : 'email'} placeholder={mode === 'login' ? 'Your username or you@school.edu' : 'you@school.edu'}/></label><label>Password<input required type="password" minLength={mode === 'login' ? undefined : 8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters"/></label><button className="auth-submit" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Request an account'}</button></form>{message && <div className="auth-message" role="status">{message}</div>}<button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }}>{mode === 'login' ? 'New to VOSKI? Request an account' : 'Already approved? Sign in'}</button><div className="auth-foot">Your account must be approved by an administrator before class data is available.</div></section></main>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  useEffect(() => { if (!user) document.documentElement.dataset.theme = 'light' }, [user])
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null))
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase) return
    if (!user) { setProfile(null); setLoading(false); return }
    setLoading(true)
    supabase.from('profiles').select('id,username,email,role,approved_at').eq('id', user.id).maybeSingle().then(({ data, error }) => { setProfile(error ? null : data); setLoading(false) })
  }, [user])
  if (!supabase) return <div className="setup-notice"><h1>Connect your Supabase project</h1><p>Create a <code>.env</code> file from <code>.env.example</code>, then run the SQL in <code>supabase/schema.sql</code> and <code>supabase/seed.sql</code>.</p></div>
  if (loading) return <div className="auth-loading">Loading your workspace...</div>
  if (!user) return <AuthScreen />
  if (!profile) return <div className="auth-loading">Loading account...</div>
  if (!profile.approved_at && profile.role !== 'admin') return <div className="auth-page"><section className="auth-card"><span className="stat-icon amber"><Clock3 size={18}/></span><h1>Approval pending</h1><p>Your account is registered. An administrator needs to approve access before your assigned class work appears.</p><button className="auth-submit" onClick={() => supabase.auth.signOut()}>Sign out</button></section></div>
  return <Dashboard user={user} profile={profile} onSignOut={() => supabase.auth.signOut()} />
}





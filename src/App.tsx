import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval, 
  startOfDay, 
  endOfDay, 
  parseISO,
  isWithinInterval,
  addWeeks,
  subWeeks,
  subDays,
  getHours,
  setHours as setDateHours,
  setMinutes
} from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Scissors, 
  Mail, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronRight, 
  ChevronLeft,
  Camera, 
  X, 
  CheckCircle2,
  Menu,
  User,
  Settings,
  Sparkles,
  Flower,
  LayoutGrid,
  List,
  Printer,
  Save,
  MessageSquare,
  Image as ImageIcon,
  Lock,
  Phone,
  Check
} from 'lucide-react';
import { Service, BusinessHours, Appointment, SalonEvent, GalleryImage } from './types';
import { generateEmailDraft, generateServiceDescription } from './services/geminiService';
import { 
  db, 
  auth, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  Timestamp,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  handleFirestoreError,
  OperationType
} from './firebase';

import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const format12h = (time24: string) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
};

// --- Components ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error) {
          errorMessage = `Firestore Error: ${parsedError.error} during ${parsedError.operationType} on ${parsedError.path}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-stone-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-serif font-medium text-stone-900 mb-4">Application Error</h2>
            <p className="text-stone-600 mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const Navbar = ({ activeTab, setActiveTab, isAdmin, setIsAdmin, onLogout }: { 
  activeTab: string, 
  setActiveTab: (tab: string) => void,
  isAdmin: boolean,
  setIsAdmin: (val: boolean) => void,
  onLogout: () => void
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = ['home', 'services', 'gallery', 'booking', 'events', 'try-it-out'];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass px-6 py-4 flex justify-between items-center">
      <div 
        className="flex items-center gap-3 cursor-pointer" 
        onClick={() => {
          setActiveTab('home');
          setIsOpen(false);
        }}
      >
        <span className="text-2xl font-serif font-bold tracking-tight rainbow-text">Hunny, bee you!</span>
      </div>
      
      {/* Desktop Menu */}
      <div className="hidden md:flex items-center gap-8 text-sm font-medium uppercase tracking-widest text-bee-white/70">
        {navLinks.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`hover:text-bee-purple transition-colors relative ${activeTab === tab ? 'text-bee-purple' : ''}`}
          >
            {tab === 'try-it-out' ? 'Try It Out' : tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="nav-underline" 
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-bee-purple" 
              />
            )}
          </button>
        ))}
        {isAdmin ? (
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-bee-blue text-bee-blue hover:bg-bee-blue hover:text-bee-white transition-all"
          >
            <Lock size={16} />
            Logout
          </button>
        ) : (
          <button 
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${activeTab === 'admin' ? 'bg-bee-purple text-bee-black border-bee-purple' : 'border-bee-white/20 hover:border-bee-purple text-bee-white'}`}
          >
            <User size={16} />
            Owner Login
          </button>
        )}
      </div>
      
      {/* Mobile Menu Toggle */}
      <div className="md:hidden">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-bee-purple hover:bg-bee-white/10 rounded-lg transition-colors"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-bee-black border-t border-bee-white/10 shadow-xl p-6 flex flex-col gap-4 md:hidden"
          >
            {navLinks.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setIsOpen(false);
                }}
                className={`text-left text-lg font-serif py-2 border-b border-bee-white/5 transition-colors ${activeTab === tab ? 'text-bee-purple' : 'text-bee-white/70'}`}
              >
                {tab === 'try-it-out' ? 'Try It Out' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            {isAdmin ? (
              <button 
                onClick={() => {
                  onLogout();
                  setIsOpen(false);
                }}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-bee-blue text-bee-blue transition-all mt-4 font-bold uppercase tracking-widest text-xs"
              >
                <Lock size={16} />
                Logout
              </button>
            ) : (
              <button 
                onClick={() => {
                  setActiveTab('admin');
                  setIsOpen(false);
                }}
                className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border transition-all mt-4 font-bold uppercase tracking-widest text-xs ${activeTab === 'admin' ? 'bg-bee-purple text-bee-black border-bee-purple' : 'border-bee-white/20 text-bee-white'}`}
              >
                <User size={16} />
                Owner Login
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Footer = () => {
  const [showSavvyModal, setShowSavvyModal] = useState(false);
  
  return (
    <footer className="bg-bee-black text-bee-white/50 py-12 px-6 border-t border-bee-white/10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xl font-serif font-bold rainbow-text">Hunny, bee you!</span>
          </div>
          <p className="text-sm leading-relaxed">
            Where Self Expression meets expert craft. Hunny, bee you! Studio provides custom hair and nails, pedicures, tanning, makeup, and event updos. If you want artistry, precision and a style that's unmistakably you, you're in the right chair.
          </p>
        </div>
        <div>
          <h4 className="text-bee-white font-bold uppercase tracking-widest text-xs mb-6">Contact</h4>
          <div className="space-y-3 text-sm">
            <p>Alexis Tucker</p>
            <p>1627 West Park Ave. </p>
            <p>Taylorville, IL. 62568</p>
            <p className="text-bee-purple">alexistucker220@gmail.com</p>
            <p>(217) 820-0675</p>
          </div>
        </div>
        <div>
          <h4 className="text-bee-white font-bold uppercase tracking-widest text-xs mb-6">Hours</h4>
          <div className="space-y-3 text-sm">
            <p>Tue - Fri: 9am - 6pm</p>
            <p>Sat: 10am - 4pm</p>
            <p className="text-bee-blue">Sun - Mon: Closed</p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-bee-white/5 text-center text-[10px] uppercase tracking-[0.2em]">
        Site developed and maintained by © 2026 <button onClick={() => setShowSavvyModal(true)} className="text-bee-purple hover:underline cursor-pointer">Savvy IT</button>
      </div>

      <AnimatePresence>
        {showSavvyModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bee-black/80 backdrop-blur-sm" 
              onClick={() => setShowSavvyModal(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-bee-black rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-bee-white/10 text-center"
            >
              <h3 className="text-2xl font-serif text-bee-purple mb-6">Savvy IT</h3>
              <div className="space-y-4 text-bee-white/70 font-sans normal-case tracking-normal">
                <p className="flex items-center justify-center gap-3">
                  <Mail size={16} className="text-bee-purple" />
                  Savvy_i_t@outlook.com
                </p>
                <p className="flex items-center justify-center gap-3">
                  <Phone size={16} className="text-bee-purple" />
                  (217) 986-0863
                </p>
              </div>
              <button 
                onClick={() => setShowSavvyModal(false)}
                className="mt-8 rainbow-bg text-bee-black px-6 py-2 rounded-xl font-bold w-full hover:scale-[1.02] transition-transform"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </footer>
  );
};

// --- Calendar Components ---

const CalendarView = ({ 
  appointments, 
  events, 
  hours 
}: { 
  appointments: Appointment[], 
  events: SalonEvent[], 
  hours: BusinessHours[] 
}) => {
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const next = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const getEventsForDay = (day: Date) => {
    const apts = appointments.filter(a => isSameDay(parseISO(a.date), day));
    const evts = events.filter(e => isSameDay(parseISO(e.date), day));
    return { appointments: apts, events: evts };
  };

  const getBusinessHoursForDay = (day: Date) => {
    const dayName = format(day, 'EEEE');
    return hours.find(h => h.day === dayName);
  };

  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
      <div className="flex items-center gap-4">
        <h2 className="text-3xl font-serif">{format(currentDate, view === 'day' ? 'MMMM d, yyyy' : 'MMMM yyyy')}</h2>
      <div className="flex items-center bg-bee-white/5 rounded-xl p-1">
        <button onClick={prev} className="p-2 hover:bg-bee-white/5 rounded-lg transition-all text-bee-white/50 hover:text-bee-white"><ChevronLeft size={18} /></button>
        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold uppercase tracking-widest hover:bg-bee-white/5 rounded-lg transition-all text-bee-white/50 hover:text-bee-white">Today</button>
        <button onClick={next} className="p-2 hover:bg-bee-white/5 rounded-lg transition-all text-bee-white/50 hover:text-bee-white"><ChevronRight size={18} /></button>
      </div>
    </div>
    <div className="flex bg-bee-white/5 rounded-xl p-1">
      {(['month', 'week', 'day'] as const).map(v => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${view === v ? 'rainbow-bg text-bee-black shadow-md' : 'text-bee-white/50 hover:bg-bee-white/5'}`}
        >
          {v}
        </button>
      ))}
    </div>
    </div>
  );

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 border-t border-l border-bee-white/10">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="p-4 text-center text-[10px] font-bold uppercase tracking-widest text-bee-white/30 border-r border-b border-bee-white/10 bg-bee-white/5">
            {d}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const { appointments: dayApts, events: dayEvts } = getEventsForDay(day);
          const dayHours = getBusinessHoursForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={i} 
              className={`min-h-[120px] p-2 border-r border-b border-bee-white/10 transition-colors ${!isCurrentMonth ? 'bg-bee-white/5' : 'bg-bee-black'} ${isToday ? 'bg-bee-yellow/5' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold ${isToday ? 'w-6 h-6 rainbow-bg text-bee-black rounded-full flex items-center justify-center' : isCurrentMonth ? 'text-bee-white' : 'text-bee-white/20'}`}>
                  {format(day, 'd')}
                </span>
                {dayHours?.is_closed && isCurrentMonth && (
                  <span className="text-[8px] font-bold uppercase text-bee-red">Closed</span>
                )}
              </div>
              <div className="space-y-1">
                {dayEvts.map(e => (
                  <div key={e.id} className="text-[9px] p-1 bg-bee-purple/10 text-bee-purple rounded border border-bee-purple/20 truncate font-medium">
                    Event: {e.title}
                  </div>
                ))}
                {dayApts.map(a => (
                  <div key={a.id} className="text-[9px] p-1 bg-bee-yellow/10 text-bee-yellow rounded border border-bee-yellow/20 truncate font-medium">
                    {format12h(a.time)} {a.client_name} - {a.services?.join(', ') || a.service_name} ({a.duration}m)
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const weekDays = eachDayOfInterval({ start: startDate, end: addDays(startDate, 6) });
    const timeSlots = Array.from({ length: 13 }, (_, i) => i + 8); // 8am to 8pm

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 border-b border-bee-white/10">
            <div className="p-4 border-r border-bee-white/10 bg-bee-white/5"></div>
            {weekDays.map(day => (
              <div key={day.toString()} className={`p-4 text-center border-r border-bee-white/10 ${isSameDay(day, new Date()) ? 'bg-bee-purple/5' : 'bg-bee-white/5'}`}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30">{format(day, 'EEE')}</div>
                <div className={`text-lg font-serif ${isSameDay(day, new Date()) ? 'text-bee-purple font-bold' : 'text-bee-white'}`}>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div className="relative">
            {timeSlots.map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b border-bee-white/5 h-20">
                <div className="p-2 text-[10px] font-bold text-bee-white/30 text-right border-r border-bee-white/10 pr-4">
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                </div>
                {weekDays.map(day => {
                  const { appointments: dayApts, events: dayEvts } = getEventsForDay(day);
                  const dayHours = getBusinessHoursForDay(day);
                  const isClosed = dayHours?.is_closed;
                  
                  const hourApts = dayApts.filter(a => {
                    const aptHour = parseInt(a.time.split(':')[0]);
                    return aptHour === hour;
                  });

                  const hourEvts = dayEvts.filter(e => {
                    const evtHour = parseInt(e.time.split(':')[0]);
                    return evtHour === hour;
                  });

                  return (
                    <div key={day.toString()} className={`border-r border-bee-white/5 relative p-1 ${isClosed ? 'bg-bee-white/5' : ''}`}>
                      {hourEvts.map(e => (
                        <div key={e.id} className="mb-1 p-2 bg-bee-purple/10 text-bee-purple rounded-lg border border-bee-purple/20 text-[10px] font-bold shadow-sm">
                          {e.title}
                        </div>
                      ))}
                      {hourApts.map(a => (
                        <div key={a.id} className="mb-1 p-2 bg-bee-blue/10 text-bee-blue rounded-lg border border-bee-blue/20 text-[10px] font-bold shadow-sm">
                          {a.client_name} - {a.services?.join(', ') || a.service_name} ({a.duration}m)
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const timeSlots = Array.from({ length: 13 }, (_, i) => i + 8);
    const { appointments: dayApts, events: dayEvts } = getEventsForDay(currentDate);
    const dayHours = getBusinessHoursForDay(currentDate);

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 p-6 rounded-3xl bg-bee-white/5 border border-bee-white/10 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-serif font-bold text-bee-purple">{format(currentDate, 'EEEE, MMMM do')}</h3>
            <p className="text-sm text-bee-white/70">
              {dayHours?.is_closed ? 'Salon is Closed' : `Open: ${dayHours?.open_time} - ${dayHours?.close_time}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-serif text-bee-purple">{dayApts.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-bee-white/50">Appointments</div>
          </div>
        </div>

        <div className="space-y-4">
          {timeSlots.map(hour => {
            const hourApts = dayApts.filter(a => parseInt(a.time.split(':')[0]) === hour);
            const hourEvts = dayEvts.filter(e => parseInt(e.time.split(':')[0]) === hour);
            
            return (
              <div key={hour} className="flex gap-6 group">
                <div className="w-16 pt-2 text-right text-[10px] font-bold text-bee-white/30 uppercase tracking-widest">
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                </div>
                <div className="flex-1 min-h-[80px] pb-4 border-b border-bee-white/5">
                  <div className="grid grid-cols-1 gap-2">
                    {hourEvts.map(e => (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={e.id} 
                        className="p-4 bg-bee-purple/20 border border-bee-purple/30 rounded-2xl flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-bee-purple">{e.title}</div>
                          <div className="text-xs text-bee-purple/70">{format12h(e.time)} • {e.capacity} spots</div>
                        </div>
                        <Sparkles className="text-bee-purple/50" size={20} />
                      </motion.div>
                    ))}
                    {hourApts.map(a => (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={a.id} 
                        className="p-4 bg-bee-white/5 border border-bee-white/10 rounded-2xl shadow-sm flex justify-between items-center hover:border-bee-purple/30 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-bee-white">{a.client_name}</div>
                          <div className="text-xs text-bee-white/50">
                            {a.services?.join(', ') || a.service_name} • {format12h(a.time)} • {a.duration} mins
                          </div>
                          {a.notes && (
                            <div className="text-[10px] text-bee-purple/70 mt-1 italic">
                              Note: {a.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button className="p-2 text-bee-white/30 hover:text-bee-purple transition-colors"><Mail size={16} /></button>
                          <div className="w-8 h-8 bg-bee-white/10 rounded-full flex items-center justify-center text-bee-purple">
                            <Scissors size={14} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {hourApts.length === 0 && hourEvts.length === 0 && (
                      <div className="h-full flex items-center text-bee-white/10 text-xs italic group-hover:text-bee-white/20 transition-colors">
                        No bookings scheduled
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500">
      {renderHeader()}
      <div className="glass rounded-[32px] overflow-hidden border border-bee-white/10">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>
    </div>
  );
};

// --- Pages ---

const TryItOutPage = () => {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTryOn = async () => {
    if (!image || !prompt) return;
    setLoading(true);
    try {
      const base64Data = image.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
            {
              text: `Apply the following hair style/color change to the person in the image: ${prompt}. Keep the person's face and features the same, only change the hair. Return the modified image.`,
            },
          ],
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setResult(`data:image/png;base64,${part.inlineData.data}`);
        }
      }
    } catch (error) {
      console.error("Error with AI Try On:", error);
      alert("Something went wrong with the AI transformation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-5xl font-serif mb-4 rainbow-text">Try It Out</h2>
        <p className="text-bee-white/50 uppercase tracking-widest text-xs font-bold">Visualize Your Next Transformation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div className="glass rounded-[40px] p-8 border border-bee-white/10">
            <h3 className="text-2xl font-serif text-bee-purple mb-6">1. Upload Your Photo</h3>
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border-2 border-dashed border-bee-white/10 flex flex-center justify-center bg-bee-white/5 group hover:border-bee-purple/50 transition-all">
              {image ? (
                <img src={image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex flex-col items-center justify-center text-bee-white/30">
                  <Camera size={48} className="mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Click to Upload or Take Photo</p>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="glass rounded-[40px] p-8 border border-bee-white/10">
            <h3 className="text-2xl font-serif text-bee-purple mb-6">2. Describe Your Dream Look</h3>
            <div className="space-y-4">
              <textarea 
                placeholder="e.g., Platinum blonde bob, honey brown highlights with beach waves, or a sleek pixie cut..."
                className="w-full h-32 p-4 rounded-2xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple transition-all resize-none"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button 
                onClick={handleTryOn}
                disabled={!image || !prompt || loading}
                className="w-full rainbow-bg text-bee-black py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <Sparkles className="animate-spin" size={20} />
                    Processing Magic...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    See the Transformation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="glass rounded-[40px] p-8 border border-bee-white/10 flex flex-col">
          <h3 className="text-2xl font-serif text-bee-purple mb-6">3. Your Result</h3>
          <div className="flex-1 rounded-3xl overflow-hidden border border-bee-white/10 bg-bee-white/5 flex items-center justify-center relative">
            {result ? (
              <motion.img 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                src={result} 
                alt="AI Result" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-center p-8 text-bee-white/20">
                <Sparkles size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Your AI Transformation will appear here</p>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 bg-bee-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-bee-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-bee-purple font-bold uppercase tracking-widest text-xs">Mixing the colors...</p>
                </div>
              </div>
            )}
          </div>
          {result && (
            <button 
              onClick={() => {
                const link = document.createElement('a');
                link.href = result;
                link.download = 'my-hunny-bee-look.png';
                link.click();
              }}
              className="mt-6 w-full py-3 rounded-xl border border-bee-white/10 text-bee-white/50 font-bold uppercase tracking-widest text-[10px] hover:bg-bee-white/5 transition-all"
            >
              Download Result
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const GalleryPage = ({ images }: { images: GalleryImage[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { scrollYProgress } = useScroll({
    target: isHydrated ? containerRef : undefined,
    offset: ["start start", "end end"]
  });

  const rotation = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const smoothRotation = useSpring(rotation, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Calculate 3D positions
  const radius = 500; // Fixed radius for the 3D ring
  const itemCount = images.length || 1;
  const angleStep = 360 / itemCount;

  if (images.length === 0) {
    return (
      <div className="pt-32 pb-24 px-6 text-center">
        <h2 className="text-5xl font-serif mb-4 rainbow-text">Gallery</h2>
        <p className="text-bee-white/50">No images yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-[300vh] bg-bee-black overflow-clip">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-24 text-center z-10 pointer-events-none">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-serif mb-4 rainbow-text"
          >
            Gallery
          </motion.h2>
          <p className="text-bee-white/50 uppercase tracking-widest text-xs font-bold">Scroll to Explore Our Work</p>
        </div>

        {/* 3D Scene Container */}
        <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: '2000px' }}>
          <motion.div 
            style={{ 
              rotateY: smoothRotation,
              rotateX: -10, // Slight tilt for better 3D effect
              transformStyle: 'preserve-3d',
            }}
            className="relative w-[280px] h-[380px] md:w-[350px] md:h-[480px]"
          >
            {images.map((image, i) => {
              const angle = i * angleStep;
              return (
                <motion.div
                  key={image.id}
                  className="absolute inset-0 rounded-2xl overflow-hidden border border-bee-white/10 shadow-2xl bg-bee-black/50 backdrop-blur-sm group cursor-pointer"
                  style={{
                    transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                    backfaceVisibility: 'hidden',
                  }}
                  whileHover={{ scale: 1.05, zIndex: 50 }}
                >
                  <img 
                    src={image.url} 
                    alt={image.caption || "Gallery Image"} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bee-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                    <p className="text-bee-white font-serif italic text-sm">{image.caption}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-bee-white/30">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-bee-purple to-transparent" />
        </motion.div>

        {/* Decorative background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-bee-purple/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-bee-black to-transparent" />
        </div>
      </div>
    </div>
  );
};

const AdminLoginPage = ({ onLogin }: { onLogin: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err: any) {
      console.error("Login error:", err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 flex items-center justify-center min-h-[80vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-bee-black rounded-[40px] p-10 border border-bee-white/10 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rainbow-bg rounded-full flex items-center justify-center text-bee-black mx-auto mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h2 className="text-3xl font-serif text-bee-purple">Owner Login</h2>
          <p className="text-bee-white/50 text-sm mt-2">Enter your credentials to access the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Email</label>
            <input 
              type="email" 
              required
              className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 focus:border-bee-purple outline-none transition-all text-bee-white"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Password</label>
            <input 
              type="password" 
              required
              className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 focus:border-bee-purple outline-none transition-all text-bee-white"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          
          {error && <p className="text-bee-blue text-xs font-bold">{error}</p>}

          <button 
            disabled={loading}
            className="w-full rainbow-bg text-bee-black py-4 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
const HomePage = ({ onBook }: { onBook: () => void }) => (
  <div className="pt-24">
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden py-20">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=2000" 
          alt="Salon Interior" 
          className="w-full h-full object-cover opacity-20"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bee-black/20 to-bee-black" />
      </div>
      
      <div className="relative z-10 text-center px-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-bee-purple font-bold uppercase tracking-[0.3em] text-sm mb-4 block">Welcome to Hunny, bee you!</span>
          <h1 className="text-6xl md:text-7xl font-serif leading-tight mb-8">
            Where Self Expression <br />
            meets <span className="italic rainbow-text">expert craft</span>.
          </h1>
          <p className="text-lg text-bee-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
            Hunny, bee you! Studio provides custom hair and nails, pedicures, tanning, makeup, and event updos. If you want artistry, precision and a style that's unmistakably you, you're in the right chair.
          </p>
          <button 
            onClick={onBook}
            className="rainbow-bg text-bee-black px-10 py-4 rounded-full text-lg font-bold hover:scale-105 transition-all shadow-xl flex items-center gap-3 mx-auto"
          >
            Book Your Session <ChevronRight size={20} />
          </button>
        </motion.div>
      </div>
    </section>

    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {[
          { icon: <Scissors className="text-bee-purple" />, title: "Expert Styling", desc: "Our experts are masters of their craft, ensuring you leave feeling like royalty." },
          { icon: <Sparkles className="text-bee-purple" />, title: "Premium Products", desc: "We use only the finest honey-infused and organic products for your hair." },
          { icon: <Clock className="text-bee-purple" />, title: "Timely Service", desc: "Your time is precious. We value punctuality and dedicated attention." }
        ].map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className="p-8 rounded-3xl bg-bee-white/5 border border-bee-white/10 hover:border-bee-purple/30 transition-all"
          >
            <div className="w-12 h-12 bg-bee-white/10 rounded-2xl flex items-center justify-center mb-6">
              {item.icon}
            </div>
            <h3 className="text-xl font-serif font-bold mb-3 text-bee-purple">{item.title}</h3>
            <p className="text-bee-white/70 text-sm leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  </div>
);

const ServicesPage = ({ services }: { services: Service[] }) => (
  <div className="pt-32 pb-24 px-6 max-w-5xl mx-auto">
    <div className="text-center mb-16">
      <h2 className="text-5xl font-serif mb-4 rainbow-text">Our Menu</h2>
      <p className="text-bee-white/50 uppercase tracking-widest text-xs font-bold">Sweet Treatments for Every Crown</p>
    </div>
    
    <div className="space-y-8">
      {services.map((service, i) => (
        <motion.div 
          key={service.id}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="flex flex-col md:flex-row md:items-center justify-between p-8 rounded-3xl bg-bee-white/5 border border-bee-white/10 group hover:border-bee-purple/30 transition-colors"
        >
          <div className="mb-4 md:mb-0">
            <h3 className="text-2xl font-serif font-bold text-bee-white group-hover:text-bee-purple transition-colors">{service.name}</h3>
            <p className="text-bee-white/50 text-sm mt-1 max-w-md">{service.description}</p>
            <div className="flex items-center gap-4 mt-3 text-xs font-bold uppercase tracking-tighter text-bee-purple">
              <span className="flex items-center gap-1"><Clock size={14} /> {service.duration}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-serif font-light text-bee-purple">${service.price}</span>
            <div className="text-[10px] uppercase tracking-widest text-bee-white/30 mt-1">Starting at</div>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const BOOKING_SERVICES = [
  { name: 'Haircut', duration: 45, price: 45 },
  { name: 'Hair Color', duration: 120, price: 85 },
  { name: 'Highlights', duration: 150, price: 120 },
  { name: 'Balayage', duration: 180, price: 180 },
  { name: 'Blowout', duration: 45, price: 35 },
  { name: 'Manicure', duration: 30, price: 25 },
  { name: 'Pedicure', duration: 45, price: 40 },
  { name: 'Tanning', duration: 20, price: 30 },
  { name: 'Makeup', duration: 60, price: 65 },
  { name: 'Event Updo', duration: 90, price: 75 },
  { name: 'Other Service', duration: 30, price: 0 },
];

const BookingPage = ({ services: _services, hours, onComplete }: { services: Service[], hours: BusinessHours[], onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    consent: false,
    services: [] as string[],
    date: '',
    time: '',
    image_url: '',
    notes: ''
  });

  const totalDuration = formData.services.reduce((acc, serviceName) => {
    const service = BOOKING_SERVICES.find(s => s.name === serviceName);
    return acc + (service?.duration || 0);
  }, 0);

  const totalPrice = formData.services.reduce((acc, serviceName) => {
    const service = BOOKING_SERVICES.find(s => s.name === serviceName);
    return acc + (service?.price || 0);
  }, 0);

  useEffect(() => {
    if (formData.date && totalDuration > 0) {
      // Replicating slot logic on client side for now
      // In a real app, this might be a cloud function
      const checkAvailability = async () => {
        const path = 'appointments';
        try {
          const q = query(collection(db, path), where('date', '==', formData.date));
          const snapshot = await getDocs(q);
          const dayAppointments = snapshot.docs.map(doc => doc.data() as Appointment);
          
          const dayName = format(parseISO(formData.date), 'EEEE');
          const dayHours = hours.find(h => h.day === dayName);
          
          if (!dayHours || dayHours.is_closed) {
            setAvailableSlots([]);
            return;
          }

          const slots: string[] = [];
          const [openH, openM] = dayHours.open_time.split(':').map(Number);
          const [closeH, closeM] = dayHours.close_time.split(':').map(Number);
          
          let current = new Date(formData.date);
          current.setHours(openH, openM, 0, 0);
          
          const end = new Date(formData.date);
          end.setHours(closeH, closeM, 0, 0);

          while (current.getTime() + totalDuration * 60000 <= end.getTime()) {
            const timeStr = format(current, 'HH:mm');
            
            const isOverlapping = dayAppointments.some(apt => {
              const aptStart = new Date(`${apt.date}T${apt.time}`);
              const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
              const newStart = new Date(`${formData.date}T${timeStr}`);
              const newEnd = new Date(newStart.getTime() + totalDuration * 60000);
              
              return (newStart < aptEnd && newEnd > aptStart);
            });

            if (!isOverlapping) {
              slots.push(timeStr);
            }
            current = addDays(current, 0); // just to be safe, but we're changing hours
            current.setMinutes(current.getMinutes() + 30);
          }
          setAvailableSlots(slots);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, path);
        }
      };
      
      checkAvailability();
    }
  }, [formData.date, totalDuration, hours]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'appointments';
    try {
      await addDoc(collection(db, path), {
        ...formData,
        duration: totalDuration,
        totalPrice: totalPrice,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      setStep(4);
      setTimeout(onComplete, 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const toggleService = (name: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(name) 
        ? prev.services.filter(s => s !== name)
        : [...prev.services, name]
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 max-w-3xl mx-auto">
      <div className="bg-bee-black rounded-[40px] p-10 shadow-2xl border border-bee-white/10">
        <div className="flex justify-between mb-12 relative">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= s ? 'rainbow-bg text-bee-black' : 'bg-bee-white/10 text-bee-white/30'}`}>
                {s}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest mt-2 text-bee-white/30">
                {s === 1 ? 'Service' : s === 2 ? 'Time' : 'Details'}
              </span>
            </div>
          ))}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-bee-white/5 -z-0" />
          <motion.div 
            className="absolute top-5 left-0 h-0.5 rainbow-bg -z-0"
            initial={{ width: '0%' }}
            animate={{ width: `${(step - 1) * 50}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h2 className="text-4xl font-serif mb-8 text-center text-bee-purple">Select Services</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BOOKING_SERVICES.map(s => (
                  <button
                    key={s.name}
                    onClick={() => toggleService(s.name)}
                    className={`flex justify-between items-center p-6 rounded-2xl border transition-all text-left ${formData.services.includes(s.name) ? 'border-bee-purple bg-bee-purple/10' : 'border-bee-white/10 hover:border-bee-purple/30 hover:bg-bee-white/5'}`}
                  >
                    <div>
                      <div className="font-bold text-lg text-bee-white">{s.name}</div>
                      <div className="text-sm text-bee-white/50">{s.duration} mins</div>
                    </div>
                    {formData.services.includes(s.name) && (
                      <div className="w-6 h-6 rounded-full rainbow-bg flex items-center justify-center">
                        <Check size={14} className="text-bee-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-12 flex justify-center">
                <button 
                  disabled={formData.services.length === 0}
                  onClick={() => setStep(2)}
                  className="px-12 py-4 rounded-2xl font-bold rainbow-bg text-bee-black shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  Continue to Time &rarr;
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <button onClick={() => setStep(1)} className="text-bee-purple text-sm font-bold mb-6 flex items-center gap-1">
                &larr; Back to Services
              </button>
              <h2 className="text-4xl font-serif mb-8 text-center text-bee-purple">Pick a Time</h2>
              <div className="space-y-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Select Date</label>
                  <input 
                    required
                    type="date" 
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 focus:border-bee-purple outline-none transition-all text-bee-white"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                {formData.date && (
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Available Slots</label>
                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {availableSlots.map(slot => (
                          <button
                            key={slot}
                            onClick={() => {
                              setFormData({ ...formData, time: slot });
                              setStep(3);
                            }}
                            className={`p-3 rounded-xl border text-sm font-bold transition-all ${formData.time === slot ? 'rainbow-bg text-bee-black border-bee-purple' : 'border-bee-white/10 text-bee-white hover:border-bee-purple/30'}`}
                          >
                            {format12h(slot)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-bee-white/5 rounded-2xl text-bee-white/30 text-sm italic">
                        No slots available for this date. Please try another day.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <button onClick={() => setStep(2)} className="text-bee-purple text-sm font-bold mb-6 flex items-center gap-1">
                &larr; Back to Time
              </button>
              <h2 className="text-4xl font-serif mb-8 text-center text-bee-purple">Final Details</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-6 bg-bee-purple/5 rounded-2xl border border-bee-purple/20 mb-8">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-bee-purple mb-4">Booking Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-bee-white/50">Services:</span>
                      <span className="font-bold text-bee-white text-right">{formData.services.join(', ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-bee-white/50">Date & Time:</span>
                      <span className="font-bold text-bee-white">{formData.date} at {format12h(formData.time)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-serif pt-2 border-t border-bee-white/10 mt-2">
                      <span className="text-bee-purple">Total Duration:</span>
                      <span className="font-bold text-bee-purple">{totalDuration} mins</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Additional Details / Notes</label>
                  <textarea 
                    className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 focus:border-bee-purple outline-none transition-all text-bee-white h-24"
                    placeholder="Tell us more (e.g., specific hair color, special requests...)"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Full Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 focus:border-bee-purple outline-none transition-all text-bee-white"
                      placeholder="Jane Doe"
                      value={formData.client_name}
                      onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Email Address</label>
                    <input 
                      required
                      type="email" 
                      className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 focus:border-bee-purple outline-none transition-all text-bee-white"
                      placeholder="jane@example.com"
                      value={formData.client_email}
                      onChange={e => setFormData({ ...formData, client_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Phone Number</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 focus:border-bee-purple outline-none transition-all text-bee-white"
                      placeholder="(555) 000-0000"
                      value={formData.client_phone}
                      onChange={e => setFormData({ ...formData, client_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-bee-white/5 rounded-2xl border border-bee-white/10">
                  <input 
                    type="checkbox" 
                    id="consent"
                    className="mt-1 w-4 h-4 rounded border-bee-white/20 bg-bee-black text-bee-purple focus:ring-bee-purple"
                    checked={formData.consent}
                    onChange={e => setFormData({ ...formData, consent: e.target.checked })}
                  />
                  <label htmlFor="consent" className="text-xs text-bee-white/50 leading-relaxed">
                    I consent to receive text messages and emails from HoneyBeeYou Salon regarding my appointment and future promotions.
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-bee-white/30">Inspiration Image (Optional)</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden" 
                      id="image-upload" 
                    />
                    <label 
                      htmlFor="image-upload"
                      className="w-full p-8 rounded-2xl border-2 border-dashed border-bee-white/10 hover:border-bee-purple/30 flex flex-col items-center justify-center cursor-pointer transition-all bg-bee-white/5"
                    >
                      {formData.image_url ? (
                        <div className="relative">
                          <img src={formData.image_url} className="h-32 rounded-lg" alt="Preview" />
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); setFormData({...formData, image_url: ''}) }}
                            className="absolute -top-2 -right-2 bg-bee-blue text-bee-white p-1 rounded-full"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Camera size={32} className="text-bee-white/20 mb-2" />
                          <span className="text-sm text-bee-white/30">Click to upload a photo of your desired style</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full rainbow-bg text-bee-black py-5 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-all shadow-xl"
                >
                  Confirm Booking
                </button>
              </form>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 bg-bee-green/20 text-bee-green rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-4xl font-serif mb-4 text-bee-purple">You're Booked!</h2>
              <p className="text-bee-white/70">We've confirmed your appointment. A confirmation email has been sent to {formData.client_email}.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const EventsPage = ({ events }: { events: SalonEvent[] }) => {
  const [registering, setRegistering] = useState<string | null>(null);
  const [regData, setRegData] = useState({ name: '', email: '' });
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registering) return;
    const path = 'event_registrations';
    try {
      const res = await addDoc(collection(db, path), {
        eventId: registering,
        ...regData,
        createdAt: Timestamp.now()
      });
      
      if (res.id) {
        // Update registration count on event
        const eventRef = doc(db, 'events', registering);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          await updateDoc(eventRef, {
            registration_count: (eventSnap.data().registration_count || 0) + 1
          });
        }
        setSuccess(true);
        setTimeout(() => {
          setRegistering(null);
          setSuccess(false);
          setRegData({ name: '', email: '' });
        }, 2000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-5xl font-serif mb-4 rainbow-text">Salon Events</h2>
        <p className="text-bee-white/50 uppercase tracking-widest text-xs font-bold">Workshops, Mixers & Pop-ups</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {events.map((event) => (
          <div key={event.id} className="bg-bee-white/5 rounded-3xl overflow-hidden border border-bee-white/10 shadow-sm hover:border-bee-purple/30 transition-all">
            <div className="h-48 bg-bee-white/10 relative">
              <div className="absolute inset-0 flex items-center justify-center text-bee-purple opacity-10">
                <Flower size={120} />
              </div>
              <div className="absolute bottom-4 left-6 bg-bee-black px-4 py-2 rounded-xl shadow-sm border border-bee-white/10">
                <div className="text-xs font-bold text-bee-purple uppercase tracking-widest">{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
            <div className="p-8">
              <h3 className="text-2xl font-serif font-bold mb-3 text-bee-white">{event.title}</h3>
              <p className="text-bee-white/50 text-sm mb-6 leading-relaxed">{event.description}</p>
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-bee-white/30 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} /> {event.time} • {event.capacity} spots
                </div>
                <button 
                  onClick={() => setRegistering(event.id)}
                  className="bg-bee-white/10 text-bee-white px-6 py-2 rounded-full text-sm font-bold hover:bg-bee-purple hover:text-bee-black transition-all"
                >
                  Register
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {registering && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-bee-black/80 backdrop-blur-sm" onClick={() => setRegistering(null)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-bee-black rounded-[32px] p-10 max-w-md w-full shadow-2xl border border-bee-white/10"
          >
            {success ? (
              <div className="text-center py-8">
                <CheckCircle2 size={48} className="text-bee-green mx-auto mb-4" />
                <h3 className="text-2xl font-serif mb-2 text-bee-purple">You're In!</h3>
                <p className="text-bee-white/50">We've added you to the guest list.</p>
              </div>
            ) : (
              <>
                <h3 className="text-3xl font-serif mb-6 text-bee-purple">Event Registration</h3>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30">Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 outline-none focus:border-bee-purple text-bee-white"
                      value={regData.name}
                      onChange={e => setRegData({ ...regData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30">Email</label>
                    <input 
                      required
                      type="email" 
                      className="w-full p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 outline-none focus:border-bee-purple text-bee-white"
                      value={regData.email}
                      onChange={e => setRegData({ ...regData, email: e.target.value })}
                    />
                  </div>
                  <button className="w-full rainbow-bg text-bee-black py-4 rounded-xl font-bold mt-4 hover:scale-[1.02] transition-all">Confirm Spot</button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ 
  services, 
  appointments, 
  hours, 
  events,
  gallery,
  onRefresh 
}: { 
  services: Service[], 
  appointments: Appointment[], 
  hours: BusinessHours[],
  events: SalonEvent[],
  gallery: GalleryImage[],
  onRefresh: () => void 
}) => {
  const [activeSubTab, setActiveSubTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [emailDraft, setEmailDraft] = useState<{ id: number, text: string } | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ id: number, notes: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState<SalonEvent | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);

  useEffect(() => {
    if (appointments.length > 0) {
      const totalRevenue = appointments.reduce((acc, apt) => acc + (apt.totalPrice || 0), 0);
      const totalAppointments = appointments.length;
      const uniqueEmails = new Set(appointments.map(a => a.client_email)).size;
      
      // Simple daily stats
      const dailyMap = new Map();
      appointments.forEach(apt => {
        const date = apt.date;
        const current = dailyMap.get(date) || { date, count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += (apt.totalPrice || 0);
        dailyMap.set(date, current);
      });
      
      const dailyStats = Array.from(dailyMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7);

      setStats({
        totalRevenue,
        totalAppointments,
        newClients: uniqueEmails,
        dailyStats
      });
    }
  }, [appointments]);

  const activeAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return aptDate >= today;
  });

  const handleDeleteAppointment = async (id: string) => {
    if (confirm('Delete this appointment?')) {
      const path = `appointments/${id}`;
      try {
        await deleteDoc(doc(db, 'appointments', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const handleGenerateDraft = async (apt: Appointment) => {
    const draft = await generateEmailDraft(apt.client_name, apt.date, apt.service_name || 'Hair Service');
    setEmailDraft({ id: apt.id as any, text: draft || '' });
  };

  const handleSaveNotes = async () => {
    if (!editingNotes) return;
    const path = `appointments/${editingNotes.id}`;
    try {
      await updateDoc(doc(db, 'appointments', editingNotes.id as any), {
        notes: editingNotes.notes
      });
      setEditingNotes(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleAddService = () => {
    setEditingService({ name: '', price: 0, duration: '', description: '' } as Service);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    
    const path = editingService.id ? `services/${editingService.id}` : 'services';
    try {
      if (editingService.id) {
        await updateDoc(doc(db, 'services', editingService.id as any), {
          name: editingService.name,
          price: editingService.price,
          duration: editingService.duration,
          description: editingService.description
        });
      } else {
        await addDoc(collection(db, 'services'), {
          ...editingService,
          createdAt: Timestamp.now()
        });
      }
      setEditingService(null);
    } catch (err) {
      handleFirestoreError(err, editingService.id ? OperationType.UPDATE : OperationType.WRITE, path);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (confirm('Delete this service?')) {
      const path = `services/${id}`;
      try {
        await deleteDoc(doc(db, 'services', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const handleUpdateHours = async () => {
    const path = 'business_hours';
    try {
      await Promise.all(hours.map(h => 
        setDoc(doc(db, 'business_hours', h.day), h)
      ));
      alert('Business hours updated successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const caption = prompt('Enter a caption for this image:');
        const path = 'gallery';
        try {
          await addDoc(collection(db, path), {
            url: reader.result as string,
            caption,
            createdAt: Timestamp.now()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteGallery = async (id: string) => {
    if (confirm('Delete this image from gallery?')) {
      const path = `gallery/${id}`;
      try {
        await deleteDoc(doc(db, 'gallery', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  };

  const handlePrintSchedule = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const scheduleHtml = `
      <html>
        <head>
          <title>Hunny, bee you! Schedule - ${format(new Date(), 'yyyy-MM-dd')}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            h1 { color: #A855F7; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Hunny, bee you! Salon Schedule</h1>
          <p>Generated on: ${format(new Date(), 'PPPP p')}</p>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Client</th>
                <th>Service</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${appointments
                .filter(a => isSameDay(parseISO(a.date), new Date()))
                .map(a => `
                  <tr>
                    <td>${a.time}</td>
                    <td>${a.client_name}</td>
                    <td>${a.service_name}</td>
                    <td>${a.notes || ''}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(scheduleHtml);
    printWindow.document.close();
    printWindow.print();
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    
    const path = editingEvent.id ? `events/${editingEvent.id}` : 'events';
    try {
      if (editingEvent.id) {
        await updateDoc(doc(db, 'events', editingEvent.id as any), {
          title: editingEvent.title,
          date: editingEvent.date,
          time: editingEvent.time,
          capacity: editingEvent.capacity,
          description: editingEvent.description
        });
      } else {
        await addDoc(collection(db, 'events'), {
          ...editingEvent,
          registration_count: 0,
          createdAt: Timestamp.now()
        });
      }
      setEditingEvent(null);
    } catch (err) {
      handleFirestoreError(err, editingEvent.id ? OperationType.UPDATE : OperationType.WRITE, path);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 space-y-2">
          {[
            { id: 'dashboard', icon: <LayoutGrid size={18} />, label: 'Dashboard' },
            { id: 'calendar', icon: <CalendarIcon size={18} />, label: 'Calendar' },
            { id: 'appointments', icon: <List size={18} />, label: 'Appointments' },
            { id: 'services', icon: <Scissors size={18} />, label: 'Price Sheet' },
            { id: 'hours', icon: <Clock size={18} />, label: 'Business Hours' },
            { id: 'events', icon: <Sparkles size={18} />, label: 'Events' },
            { id: 'gallery', icon: <ImageIcon size={18} />, label: 'Gallery' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${activeSubTab === tab.id ? 'rainbow-bg text-bee-black shadow-lg' : 'text-bee-white/50 hover:bg-bee-white/5'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </aside>

        <main className="flex-1 bg-bee-white/5 rounded-[32px] p-8 border border-bee-white/10 shadow-sm min-h-[60vh]">
          {activeSubTab === 'dashboard' && stats && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-serif text-bee-purple">Overview</h2>
                <div className="flex gap-4">
                  <button 
                    onClick={handlePrintSchedule}
                    className="flex items-center gap-2 bg-bee-white/10 text-bee-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-bee-white/20 transition-all"
                  >
                    <Printer size={16} /> Print Today's Schedule
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 rounded-[32px] rainbow-bg text-bee-black shadow-xl">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-2">Total Revenue</div>
                  <div className="text-4xl font-serif">${stats.totalRevenue.toFixed(2)}</div>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase">
                    <span className="text-bee-black/70">↑ 12%</span> vs last month
                  </div>
                </div>
                <div className="p-8 rounded-[32px] bg-bee-black border border-bee-white/10 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-bee-white/30 mb-2">Appointments</div>
                  <div className="text-4xl font-serif text-bee-white">{stats.totalAppointments}</div>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase">
                    <span className="text-bee-purple">{appointments.filter(a => a.status === 'pending').length} pending</span>
                  </div>
                </div>
                <div className="p-8 rounded-[32px] bg-bee-black border border-bee-white/10 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-bee-white/30 mb-2">New Clients</div>
                  <div className="text-4xl font-serif text-bee-white">{stats.newClients}</div>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase">
                    <span className="text-bee-white/30">Total unique emails</span>
                  </div>
                </div>
              </div>

              <div className="bg-bee-black rounded-[32px] p-8 border border-bee-white/10">
                <h3 className="text-xl font-serif mb-6 text-bee-purple">Recent Activity</h3>
                <div className="space-y-4">
                  {stats.dailyStats.map((day: any) => (
                    <div key={day.date} className="flex items-center justify-between p-4 bg-bee-white/5 rounded-2xl border border-bee-white/10">
                      <div>
                        <div className="font-bold text-bee-white">{format(parseISO(day.date), 'EEEE, MMM do')}</div>
                        <div className="text-xs text-bee-white/30">{day.count} appointments</div>
                      </div>
                      <div className="text-right">
                        <div className="font-serif text-lg text-bee-purple">${day.revenue.toFixed(2)}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30">Revenue</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeSubTab === 'calendar' && (
            <CalendarView 
              appointments={appointments} 
              events={events} 
              hours={hours} 
            />
          )}
          {activeSubTab === 'appointments' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-serif text-bee-purple">Manage Appointments</h2>
                <div className="text-xs font-bold text-bee-white/30 uppercase tracking-widest">{appointments.length} Total</div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-bee-white/10">
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-bee-white/30">Client</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-bee-white/30">Service</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-bee-white/30">Date/Time</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-bee-white/30">Status</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-bee-white/30 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bee-white/5">
                    {activeAppointments.map(apt => (
                      <tr key={apt.id} className="group">
                        <td className="py-4">
                          <div className="font-bold text-bee-white">{apt.client_name}</div>
                          <div className="text-xs text-bee-white/30">{apt.client_email}</div>
                          <div className="text-[10px] text-bee-white/40">{apt.client_phone}</div>
                          {apt.consent ? (
                            <div className="text-[8px] text-emerald-400 mt-1 uppercase font-bold">✓ Consent Given</div>
                          ) : (
                            <div className="text-[8px] text-bee-white/20 mt-1 uppercase font-bold">No Consent</div>
                          )}
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-1">
                            {apt.services?.map((s, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-bee-purple/10 text-bee-purple rounded-full font-medium">{s}</span>
                            ))}
                            {!apt.services?.length && (
                              <span className="text-sm px-3 py-1 bg-bee-purple/10 text-bee-purple rounded-full font-medium">{apt.service_name}</span>
                            )}
                          </div>
                          {apt.notes && (
                            <div className="text-[10px] text-bee-white/40 mt-1 max-w-[200px] truncate" title={apt.notes}>
                              Note: {apt.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-4">
                          <div className="text-sm font-medium text-bee-white">{new Date(apt.date).toLocaleDateString()}</div>
                          <div className="text-xs text-bee-white/30">{format12h(apt.time)}</div>
                        </td>
                        <td className="py-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-bee-purple bg-bee-purple/10 px-2 py-1 rounded-md">{apt.status}</span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setEditingNotes({ id: apt.id, notes: apt.notes || '' })}
                              className="p-2 text-bee-white/30 hover:text-bee-purple transition-colors" title="Edit Notes"
                            >
                              <MessageSquare size={18} />
                            </button>
                            <button 
                              onClick={() => handleGenerateDraft(apt)}
                              className="p-2 text-bee-white/30 hover:text-bee-purple transition-colors" title="Draft Email"
                            >
                              <Mail size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteAppointment(apt.id)}
                              className="p-2 text-bee-white/30 hover:text-bee-blue transition-colors" title="Cancel"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editingNotes && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <div className="absolute inset-0 bg-bee-black/80 backdrop-blur-sm" onClick={() => setEditingNotes(null)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative bg-bee-black rounded-[32px] p-8 max-w-lg w-full shadow-2xl border border-bee-white/10"
                  >
                    <h3 className="text-2xl font-serif text-bee-purple mb-6">Appointment Notes</h3>
                    <textarea 
                      className="w-full h-40 p-4 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                      value={editingNotes.notes}
                      onChange={e => setEditingNotes({ ...editingNotes, notes: e.target.value })}
                      placeholder="Add internal notes about this booking..."
                    />
                    <div className="flex justify-end gap-4 mt-6">
                      <button onClick={() => setEditingNotes(null)} className="px-6 py-2 text-bee-white/50 font-bold">Cancel</button>
                      <button onClick={handleSaveNotes} className="rainbow-bg text-bee-black px-6 py-2 rounded-xl font-bold flex items-center gap-2">
                        <Save size={18} /> Save Notes
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {emailDraft && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <div className="absolute inset-0 bg-bee-black/80 backdrop-blur-sm" onClick={() => setEmailDraft(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-bee-black rounded-[32px] p-8 max-w-2xl w-full shadow-2xl border border-bee-white/10"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-serif text-bee-purple">Email Draft (AI Generated)</h3>
                      <button onClick={() => setEmailDraft(null)} className="text-bee-white/50 hover:text-bee-white"><X size={20} /></button>
                    </div>
                    <textarea 
                      className="w-full h-64 p-6 rounded-2xl bg-bee-white/5 border border-bee-white/10 font-sans text-sm leading-relaxed outline-none focus:border-bee-purple text-bee-white"
                      value={emailDraft.text}
                      onChange={e => setEmailDraft({ ...emailDraft, text: e.target.value })}
                    />
                    <div className="flex justify-end gap-4 mt-6">
                      <button 
                        onClick={() => setEmailDraft(null)}
                        className="px-6 py-3 rounded-xl text-sm font-bold text-bee-white/50 hover:bg-bee-white/5"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => { alert('Email sent (simulated)'); setEmailDraft(null); }}
                        className="px-8 py-3 rounded-xl text-sm font-bold rainbow-bg text-bee-black shadow-lg"
                      >
                        Send Email
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'services' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-serif text-bee-purple">Price Sheet</h2>
                <button 
                  onClick={handleAddService}
                  className="flex items-center gap-2 rainbow-bg text-bee-black px-4 py-2 rounded-xl text-sm font-bold"
                >
                  <Plus size={16} /> Add Service
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {services.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-6 rounded-2xl border border-bee-white/10 hover:border-bee-purple/30 transition-colors bg-bee-white/5">
                    <div>
                      <div className="font-bold text-lg text-bee-white">{s.name}</div>
                      <div className="text-sm text-bee-white/50">{s.duration} • {s.description}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-xl font-serif text-bee-purple">${s.price}</div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditService(s)} className="p-2 text-bee-white/30 hover:text-bee-purple"><Edit2 size={18} /></button>
                        <button onClick={() => handleDeleteService(s.id)} className="p-2 text-bee-white/30 hover:text-bee-blue"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {editingService && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <div className="absolute inset-0 bg-bee-black/80 backdrop-blur-sm" onClick={() => setEditingService(null)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative bg-bee-black rounded-[32px] p-8 max-w-lg w-full shadow-2xl border border-bee-white/10"
                  >
                    <h3 className="text-2xl font-serif text-bee-purple mb-6">{editingService.id ? 'Edit Service' : 'Add Service'}</h3>
                    <form onSubmit={handleSaveService} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Service Name</label>
                        <input 
                          required
                          className="w-full p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                          value={editingService.name}
                          onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Price ($)</label>
                          <input 
                            required
                            type="number"
                            step="0.01"
                            className="w-full p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                            value={editingService.price}
                            onChange={e => setEditingService({ ...editingService, price: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Duration</label>
                          <input 
                            required
                            placeholder="e.g. 1h 30m"
                            className="w-full p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                            value={editingService.duration}
                            onChange={e => setEditingService({ ...editingService, duration: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Description</label>
                        <textarea 
                          className="w-full h-24 p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                          value={editingService.description}
                          onChange={e => setEditingService({ ...editingService, description: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={() => setEditingService(null)} className="px-6 py-2 text-bee-white/50 font-bold">Cancel</button>
                        <button type="submit" className="rainbow-bg text-bee-black px-6 py-2 rounded-xl font-bold">
                          Save Service
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'hours' && (
            <div className="space-y-6">
              <h2 className="text-3xl font-serif mb-8 text-bee-purple">Business Hours</h2>
              <div className="space-y-4">
                {hours.map(h => (
                  <div key={h.day} className="flex items-center justify-between p-4 rounded-xl bg-bee-white/5 border border-bee-white/10">
                    <div className="w-32 font-bold text-bee-white/70">{h.day}</div>
                    <div className="flex items-center gap-4">
                      {h.is_closed ? (
                        <span className="text-xs font-bold text-bee-blue uppercase tracking-widest">Closed</span>
                      ) : (
                        <>
                          <input 
                            type="time" 
                            defaultValue={h.open_time} 
                            onBlur={async (e) => {
                              const path = `business_hours/${h.day}`;
                              try {
                                await updateDoc(doc(db, 'business_hours', h.day), { open_time: e.target.value });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, path);
                              }
                            }}
                            className="p-2 rounded-lg border border-bee-white/10 bg-bee-black text-bee-white text-sm" 
                          />
                          <span className="text-bee-white/30">to</span>
                          <input 
                            type="time" 
                            defaultValue={h.close_time} 
                            onBlur={async (e) => {
                              const path = `business_hours/${h.day}`;
                              try {
                                await updateDoc(doc(db, 'business_hours', h.day), { close_time: e.target.value });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, path);
                              }
                            }}
                            className="p-2 rounded-lg border border-bee-white/10 bg-bee-black text-bee-white text-sm" 
                          />
                        </>
                      )}
                    </div>
                    <button 
                      onClick={async () => {
                        const path = `business_hours/${h.day}`;
                        try {
                          await updateDoc(doc(db, 'business_hours', h.day), { is_closed: !h.is_closed });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, path);
                        }
                      }}
                      className="text-xs font-bold text-bee-purple hover:underline"
                    >
                      {h.is_closed ? 'Open' : 'Close'}
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-bee-white/30 italic">Note: Changes are saved automatically when you change a time or toggle status.</p>
            </div>
          )}

          {activeSubTab === 'events' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-serif text-bee-purple">Manage Events</h2>
                <button 
                  onClick={() => setEditingEvent({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '18:00', capacity: 20, description: '' } as SalonEvent)}
                  className="flex items-center gap-2 rainbow-bg text-bee-black px-4 py-2 rounded-xl text-sm font-bold"
                >
                  <Plus size={16} /> Create Event
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {events.map(e => (
                  <div key={e.id} className="p-6 rounded-2xl border border-bee-white/10 bg-bee-white/5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-lg text-bee-white">{e.title}</div>
                      <div className="text-sm text-bee-white/50">
                        {new Date(e.date).toLocaleDateString()} at {e.time} • 
                        <span className="text-bee-purple font-bold ml-1"> {e.registration_count}/{e.capacity} registered</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-bee-white/30 hover:text-bee-purple" onClick={() => setEditingEvent(e)}><Edit2 size={18} /></button>
                      <button className="p-2 text-bee-white/30 hover:text-bee-blue" onClick={async () => {
                        if (confirm('Delete event?')) {
                          const path = `events/${e.id}`;
                          try {
                            await deleteDoc(doc(db, 'events', e.id));
                          } catch (error) {
                            handleFirestoreError(error, OperationType.DELETE, path);
                          }
                        }
                      }}><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {editingEvent && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <div className="absolute inset-0 bg-bee-black/80 backdrop-blur-sm" onClick={() => setEditingEvent(null)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative bg-bee-black rounded-[32px] p-8 max-w-lg w-full shadow-2xl border border-bee-white/10"
                  >
                    <h3 className="text-2xl font-serif text-bee-purple mb-6">{editingEvent.id ? 'Edit Event' : 'Create Event'}</h3>
                    <form onSubmit={handleSaveEvent} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Title</label>
                        <input 
                          required
                          className="w-full p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                          value={editingEvent.title}
                          onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Date</label>
                          <input 
                            required
                            type="date"
                            className="w-full p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                            value={editingEvent.date}
                            onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Time</label>
                          <input 
                            required
                            type="time"
                            className="w-full p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                            value={editingEvent.time}
                            onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Capacity</label>
                        <input 
                          required
                          type="number"
                          className="w-full p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                          value={editingEvent.capacity}
                          onChange={e => setEditingEvent({ ...editingEvent, capacity: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-bee-white/30 block mb-1">Description</label>
                        <textarea 
                          className="w-full h-24 p-3 rounded-xl bg-bee-white/5 border border-bee-white/10 text-bee-white outline-none focus:border-bee-purple"
                          value={editingEvent.description}
                          onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={() => setEditingEvent(null)} className="px-6 py-2 text-bee-white/50 font-bold">Cancel</button>
                        <button type="submit" className="rainbow-bg text-bee-black px-6 py-2 rounded-xl font-bold">
                          Save Event
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'gallery' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-serif text-bee-purple">Manage Gallery</h2>
                <div className="flex gap-4">
                  <input 
                    type="file" 
                    id="gallery-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleGalleryUpload}
                  />
                  <label 
                    htmlFor="gallery-upload"
                    className="flex items-center gap-2 rainbow-bg text-bee-black px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
                  >
                    <Plus size={16} /> Upload Photo
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gallery.map(img => (
                  <div key={img.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-bee-white/10 bg-bee-white/5">
                    <img src={img.url} alt={img.caption} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-bee-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4 p-4 text-center">
                      <p className="text-xs text-bee-white font-serif italic mb-2">{img.caption}</p>
                      <button 
                        onClick={async () => {
                          if (confirm('Delete this image?')) {
                            const path = `gallery/${img.id}`;
                            try {
                              await deleteDoc(doc(db, 'gallery', img.id));
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, path);
                            }
                          }
                        }}
                        className="p-3 bg-bee-blue text-bee-white rounded-full hover:scale-110 transition-transform"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hours, setHours] = useState<BusinessHours[]>([]);
  const [events, setEvents] = useState<SalonEvent[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
      setLoading(false);
    });

    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Service)));
    });

    const unsubHours = onSnapshot(collection(db, 'business_hours'), (snapshot) => {
      setHours(snapshot.docs.map(doc => doc.data() as BusinessHours));
    });

    const unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as SalonEvent)));
    });

    const unsubGallery = onSnapshot(collection(db, 'gallery'), (snapshot) => {
      setGallery(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as GalleryImage)));
    });

    return () => {
      unsubAuth();
      unsubServices();
      unsubHours();
      unsubEvents();
      unsubGallery();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAppointments([]);
      return;
    }

    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as Appointment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'appointments');
    });

    return () => unsubAppointments();
  }, [isAdmin]);

  const handleLogout = async () => {
    await signOut(auth);
    setIsAdmin(false);
    setActiveTab('home');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bee-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-bee-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col">
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isAdmin={isAdmin} 
          setIsAdmin={setIsAdmin} 
          onLogout={handleLogout}
        />
        
        <main className="flex-1">
          <AnimatePresence mode="wait">
            {isAdmin ? (
              <motion.div
                key="admin-dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AdminDashboard 
                  services={services} 
                  appointments={appointments} 
                  hours={hours} 
                  events={events}
                  gallery={gallery}
                  onRefresh={() => {}} // No-op as onSnapshot handles updates
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === 'home' && <HomePage onBook={() => setActiveTab('booking')} />}
                {activeTab === 'services' && <ServicesPage services={services} />}
                {activeTab === 'gallery' && <GalleryPage images={gallery} />}
                {activeTab === 'booking' && <BookingPage services={services} hours={hours} onComplete={() => setActiveTab('home')} />}
                {activeTab === 'events' && <EventsPage events={events} />}
                {activeTab === 'try-it-out' && <TryItOutPage />}
                {activeTab === 'admin' && <AdminLoginPage onLogin={() => setIsAdmin(true)} />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Footer />
      </div>
    </ErrorBoundary>
  );
}

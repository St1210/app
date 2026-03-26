import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Dumbbell, 
  CheckCircle2, 
  Flame, 
  Target,
  TrendingUp,
  Calendar,
  Sparkles,
  MessageCircle,
  Lightbulb,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';

const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [weeklyProgress, setWeeklyProgress] = useState(null);
  const [coachMessage, setCoachMessage] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardRes, workoutsRes, weeklyRes, coachRes] = await Promise.all([
          api.get('/workout/dashboard'),
          api.get('/workout/all'),
          api.get('/workout/weekly-progress'),
          api.get('/coach/message')
        ]);
        setDashboard(dashboardRes.data);
        setRecentWorkouts(workoutsRes.data.slice(0, 5));
        setWeeklyProgress(weeklyRes.data);
        setCoachMessage(coachRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
        setDashboard({
          total_workouts: 0,
          completed_workouts: 0,
          streak: 0,
          completion_percentage: 0,
          motivational_message: "Let's start your fitness journey today!",
          intensity_level: "LOW",
          weekly_target: 5,
          weekly_completed: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleWorkoutComplete = async (workoutId) => {
    try {
      const res = await api.put(`/workout/complete/${workoutId}`);
      setRecentWorkouts(prev => 
        prev.map(w => w.id === workoutId ? res.data : w)
      );
      const [dashboardRes, weeklyRes] = await Promise.all([
        api.get('/workout/dashboard'),
        api.get('/workout/weekly-progress')
      ]);
      setDashboard(dashboardRes.data);
      setWeeklyProgress(weeklyRes.data);
      toast.success(res.data.completed ? 'Great job! Workout completed!' : 'Workout unmarked');
    } catch (error) {
      toast.error('Failed to update workout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#A3A3A3]">Loading dashboard...</div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Workouts',
      value: dashboard?.total_workouts || 0,
      icon: Dumbbell,
      color: '#007AFF',
      bgColor: 'rgba(0, 122, 255, 0.1)',
    },
    {
      label: 'Completed',
      value: dashboard?.completed_workouts || 0,
      icon: CheckCircle2,
      color: '#34C759',
      bgColor: 'rgba(52, 199, 89, 0.1)',
    },
    {
      label: 'Current Streak',
      value: dashboard?.streak || 0,
      icon: Flame,
      color: '#FF3B30',
      bgColor: 'rgba(255, 59, 48, 0.1)',
      suffix: ' days',
    },
    {
      label: 'Completion Rate',
      value: dashboard?.completion_percentage || 0,
      icon: Target,
      color: '#FF9500',
      bgColor: 'rgba(255, 149, 0, 0.1)',
      suffix: '%',
    },
  ];

  const intensityColors = {
    LOW: '#34C759',
    MEDIUM: '#007AFF',
    HIGH: '#FF9500',
    INTENSE: '#FF3B30'
  };

  return (
    <div data-testid="dashboard-page" className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1">
          <h1 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-[#A3A3A3] mt-1">
            Here's your fitness overview
          </p>
          
          {/* Intensity Badge */}
          <div className="flex items-center gap-3 mt-4">
            <span className="text-sm text-[#737373]">Current Level:</span>
            <span 
              className="px-3 py-1 text-xs font-bold uppercase tracking-wider"
              style={{ 
                backgroundColor: `${intensityColors[dashboard?.intensity_level || 'LOW']}20`,
                color: intensityColors[dashboard?.intensity_level || 'LOW']
              }}
            >
              {dashboard?.intensity_level || 'LOW'} Intensity
            </span>
          </div>
        </div>

        {/* Streak Badge */}
        {dashboard?.streak > 0 && (
          <div 
            data-testid="streak-badge"
            className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-[#FF3B30] to-[#FF9500] animate-pulse-glow"
          >
            <Flame className="w-8 h-8 text-white" />
            <div>
              <span className="font-heading text-3xl font-black text-white">
                {dashboard.streak}
              </span>
              <span className="text-white/80 text-sm ml-1">Day Streak!</span>
            </div>
          </div>
        )}
      </div>

      {/* Coach Message Card */}
      {coachMessage && (
        <Card 
          data-testid="coach-message-card"
          className="bg-gradient-to-r from-[#007AFF]/10 to-[#34C759]/10 border-[#007AFF]/30 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#007AFF] flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-lg font-bold text-[#007AFF] uppercase tracking-tight mb-2">
                Your AI Coach Says
              </h3>
              <p className="text-white text-lg font-medium mb-3">
                "{dashboard?.motivational_message || coachMessage.message}"
              </p>
              <div className="flex flex-col sm:flex-row gap-4 text-sm">
                <div className="flex items-center gap-2 text-[#A3A3A3]">
                  <Lightbulb className="w-4 h-4 text-[#FF9500]" />
                  <span>{coachMessage.tip_of_the_day}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
            className={`bg-[#141414] border-white/10 p-6 hover:border-white/20 transition-all duration-300 stagger-${index + 1}`}
            style={{ animationFillMode: 'backwards' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#737373] mb-2">
                  {stat.label}
                </p>
                <p 
                  className="font-heading text-4xl font-black tracking-tight"
                  style={{ color: stat.color }}
                >
                  {stat.value}{stat.suffix || ''}
                </p>
              </div>
              <div 
                className="w-12 h-12 flex items-center justify-center"
                style={{ backgroundColor: stat.bgColor }}
              >
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Progress Chart */}
        <Card 
          data-testid="weekly-chart"
          className="bg-[#141414] border-white/10 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#007AFF]" />
              <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight">
                This Week
              </h3>
            </div>
            <span className="text-[#34C759] font-bold">
              {weeklyProgress?.completed_this_week || 0} / {weeklyProgress?.total_this_week || 0}
            </span>
          </div>
          
          {weeklyProgress?.week_data && weeklyProgress.week_data.length > 0 ? (
            <div className="h-[200px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyProgress.week_data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <XAxis 
                    dataKey="day" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#737373', fontSize: 12 }}
                  />
                  <YAxis hide />
                  <Bar 
                    dataKey="completed" 
                    radius={[4, 4, 0, 0]}
                  >
                    {weeklyProgress.week_data.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.completed > 0 ? '#007AFF' : '#1A1A1A'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[#737373]">
              Start working out to see your weekly progress
            </div>
          )}
        </Card>

        {/* Overall Progress */}
        <Card 
          data-testid="progress-card"
          className="bg-[#141414] border-white/10 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#007AFF]" />
              <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight">
                Overall Progress
              </h3>
            </div>
            <span className="text-[#007AFF] font-bold text-2xl">
              {dashboard?.completion_percentage || 0}%
            </span>
          </div>
          <Progress 
            value={dashboard?.completion_percentage || 0} 
            className="h-4 bg-[#1A1A1A]"
          />
          <p className="text-[#A3A3A3] text-sm mt-3">
            {dashboard?.completed_workouts || 0} of {dashboard?.total_workouts || 0} workouts completed
          </p>
          
          {/* Weekly Target */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#737373] text-sm">Weekly Target</span>
              <span className="text-white font-medium">
                {dashboard?.weekly_completed || 0} / {dashboard?.weekly_target || 5}
              </span>
            </div>
            <Progress 
              value={((dashboard?.weekly_completed || 0) / (dashboard?.weekly_target || 5)) * 100} 
              className="h-2 bg-[#1A1A1A]"
            />
          </div>
        </Card>
      </div>

      {/* Recent Workouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-5 h-5 text-[#007AFF]" />
            <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight">
              Recent Workouts
            </h3>
          </div>
          <Link 
            to="/workouts"
            data-testid="view-all-workouts-link"
            className="flex items-center gap-1 text-[#007AFF] hover:text-[#005BB5] text-sm font-medium transition-colors"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <Card className="bg-[#141414] border-white/10 p-8 text-center">
            <Sparkles className="w-12 h-12 text-[#007AFF] mx-auto mb-4" />
            <p className="text-white font-medium mb-2">Ready to start?</p>
            <p className="text-[#737373] text-sm mb-4">
              Generate your first AI-powered workout plan
            </p>
            <Link 
              to="/workouts"
              data-testid="start-workout-link"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#007AFF] hover:bg-[#005BB5] text-white font-bold uppercase tracking-wider transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate Workouts
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentWorkouts.map((workout) => (
              <Card
                key={workout.id}
                data-testid={`workout-item-${workout.id}`}
                className={`bg-[#141414] border-white/10 p-4 hover:border-white/20 transition-all cursor-pointer ${
                  workout.completed ? 'border-[#34C759]/50 bg-[#34C759]/5' : ''
                }`}
                onClick={() => toggleWorkoutComplete(workout.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className={`w-10 h-10 flex items-center justify-center ${
                        workout.completed ? 'bg-[#34C759]/20' : 'bg-[#007AFF]/20'
                      }`}
                    >
                      {workout.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-[#34C759]" />
                      ) : (
                        <Dumbbell className="w-5 h-5 text-[#007AFF]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${workout.completed ? 'text-[#34C759]' : 'text-white'}`}>
                          {workout.title}
                        </h4>
                        {workout.ai_generated && (
                          <Sparkles className="w-4 h-4 text-[#007AFF]" />
                        )}
                      </div>
                      <p className="text-[#737373] text-sm line-clamp-1">{workout.description}</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className={`program-badge ${workout.program_type}`}>
                      {workout.program_type.replace('_', ' ')}
                    </span>
                    <p className="text-[#737373] text-xs mt-1">{workout.date}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

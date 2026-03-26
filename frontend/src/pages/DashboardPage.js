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
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashboardRes, workoutsRes] = await Promise.all([
          api.get('/workout/dashboard'),
          api.get('/workout/all')
        ]);
        setDashboard(dashboardRes.data);
        setRecentWorkouts(workoutsRes.data.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
        // Set default values if no workouts yet
        setDashboard({
          total_workouts: 0,
          completed_workouts: 0,
          streak: 0,
          completion_percentage: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const toggleWorkoutComplete = async (workoutId) => {
    try {
      const res = await api.put(`/workout/complete/${workoutId}`);
      setRecentWorkouts(prev => 
        prev.map(w => w.id === workoutId ? res.data : w)
      );
      // Refresh dashboard stats
      const dashboardRes = await api.get('/workout/dashboard');
      setDashboard(dashboardRes.data);
      toast.success(res.data.completed ? 'Workout completed!' : 'Workout unmarked');
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

  return (
    <div data-testid="dashboard-page" className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-[#A3A3A3] mt-1">
            Here's your fitness overview
          </p>
        </div>
        {dashboard?.streak > 0 && (
          <div 
            data-testid="streak-badge"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF3B30] to-[#FF9500] animate-streak-pulse"
          >
            <Flame className="w-5 h-5 text-white" />
            <span className="font-bold text-white">
              {dashboard.streak} Day Streak!
            </span>
          </div>
        )}
      </div>

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

      {/* Progress Section */}
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
          <span className="text-[#007AFF] font-bold text-lg">
            {dashboard?.completion_percentage || 0}%
          </span>
        </div>
        <Progress 
          value={dashboard?.completion_percentage || 0} 
          className="h-3 bg-[#1A1A1A]"
        />
        <p className="text-[#A3A3A3] text-sm mt-3">
          {dashboard?.completed_workouts || 0} of {dashboard?.total_workouts || 0} workouts completed
        </p>
      </Card>

      {/* Recent Workouts */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-[#007AFF]" />
          <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight">
            Recent Workouts
          </h3>
        </div>

        {recentWorkouts.length === 0 ? (
          <Card className="bg-[#141414] border-white/10 p-8 text-center">
            <Dumbbell className="w-12 h-12 text-[#737373] mx-auto mb-4" />
            <p className="text-[#A3A3A3] mb-2">No workouts yet</p>
            <p className="text-[#737373] text-sm">
              Generate your first workout plan to get started
            </p>
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
                      <h4 className={`font-semibold ${workout.completed ? 'text-[#34C759]' : 'text-white'}`}>
                        {workout.title}
                      </h4>
                      <p className="text-[#737373] text-sm">{workout.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
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

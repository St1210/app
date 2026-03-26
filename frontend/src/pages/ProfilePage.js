import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  User, 
  Mail, 
  Calendar,
  Dumbbell,
  CheckCircle2,
  Flame,
  Trophy,
  LogOut,
  Target,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const PROGRAM_TYPES = [
  { value: 'BEGINNER', label: 'Beginner', color: '#34C759' },
  { value: 'WEIGHT_LOSS', label: 'Weight Loss', color: '#FF3B30' },
  { value: 'MUSCLE', label: 'Muscle Building', color: '#007AFF' },
  { value: 'FLEXIBILITY', label: 'Flexibility', color: '#AF52DE' },
  { value: 'HOME', label: 'Home Workout', color: '#FF9500' },
  { value: 'REHAB', label: 'Rehabilitation', color: '#5AC8FA' },
];

const ProfilePage = () => {
  const { user, logout, updateGoal } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingGoal, setUpdatingGoal] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/workout/dashboard');
        setStats(res.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setStats({
          total_workouts: 0,
          completed_workouts: 0,
          streak: 0,
          completion_percentage: 0,
          intensity_level: 'LOW'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGoalChange = async (newGoal) => {
    setUpdatingGoal(true);
    try {
      await updateGoal(newGoal);
      toast.success('Fitness goal updated!');
    } catch (error) {
      toast.error('Failed to update goal');
    } finally {
      setUpdatingGoal(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const pieData = [
    { name: 'Completed', value: stats?.completed_workouts || 0, color: '#34C759' },
    { name: 'Remaining', value: (stats?.total_workouts || 0) - (stats?.completed_workouts || 0), color: '#1A1A1A' },
  ];

  const achievements = [
    { 
      name: 'First Workout', 
      unlocked: (stats?.total_workouts || 0) >= 1, 
      icon: Dumbbell,
      description: 'Complete your first workout'
    },
    { 
      name: '10 Workouts', 
      unlocked: (stats?.total_workouts || 0) >= 10, 
      icon: Trophy,
      description: 'Complete 10 total workouts'
    },
    { 
      name: '7 Day Streak', 
      unlocked: (stats?.streak || 0) >= 7, 
      icon: Flame,
      description: 'Maintain a 7-day streak'
    },
    { 
      name: '50% Completion', 
      unlocked: (stats?.completion_percentage || 0) >= 50, 
      icon: Target,
      description: 'Reach 50% completion rate'
    },
    { 
      name: 'Consistency King', 
      unlocked: (stats?.streak || 0) >= 14, 
      icon: TrendingUp,
      description: '14-day workout streak'
    },
    { 
      name: 'AI Explorer', 
      unlocked: (stats?.total_workouts || 0) >= 5, 
      icon: Sparkles,
      description: 'Generate AI workout plans'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#A3A3A3]">Loading profile...</div>
      </div>
    );
  }

  const currentGoal = PROGRAM_TYPES.find(p => p.value === user?.fitness_goal);

  return (
    <div data-testid="profile-page" className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Profile Header */}
      <Card className="bg-[#141414] border-white/10 p-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Avatar */}
          <div className="w-28 h-28 bg-gradient-to-br from-[#007AFF] to-[#34C759] flex items-center justify-center text-white text-5xl font-heading font-black">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          
          {/* User Info */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-heading text-3xl font-black text-white uppercase tracking-tight">
              {user?.name}
            </h1>
            <div className="flex flex-col md:flex-row items-center gap-4 mt-3 text-[#A3A3A3]">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span data-testid="user-email">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(user?.created_at)}</span>
              </div>
            </div>
            
            {/* Fitness Goal Selector */}
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
              <span className="text-sm text-[#737373]">Fitness Goal:</span>
              <Select 
                value={user?.fitness_goal || ''} 
                onValueChange={handleGoalChange}
                disabled={updatingGoal}
              >
                <SelectTrigger 
                  data-testid="fitness-goal-select"
                  className="w-[200px] bg-[#0A0A0A] border-white/10 text-white"
                >
                  <SelectValue placeholder="Select a goal" />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {PROGRAM_TYPES.map((type) => (
                    <SelectItem 
                      key={type.value} 
                      value={type.value}
                      className="text-white hover:bg-white/10"
                    >
                      <span style={{ color: type.color }}>{type.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Streak Badge */}
          {stats?.streak > 0 && (
            <div 
              data-testid="profile-streak-badge"
              className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-[#FF3B30] to-[#FF9500]"
            >
              <Flame className="w-8 h-8 text-white" />
              <div className="text-white text-center">
                <div className="font-heading font-black text-3xl">{stats.streak}</div>
                <div className="text-xs uppercase tracking-wider opacity-80">Day Streak</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Stats and Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card 
            data-testid="profile-stat-total"
            className="bg-[#141414] border-white/10 p-6 text-center"
          >
            <div className="w-12 h-12 bg-[#007AFF]/20 flex items-center justify-center mx-auto mb-3">
              <Dumbbell className="w-6 h-6 text-[#007AFF]" />
            </div>
            <p className="font-heading text-3xl font-black text-[#007AFF]">
              {stats?.total_workouts || 0}
            </p>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#737373] mt-1">
              Total Workouts
            </p>
          </Card>

          <Card 
            data-testid="profile-stat-completed"
            className="bg-[#141414] border-white/10 p-6 text-center"
          >
            <div className="w-12 h-12 bg-[#34C759]/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-[#34C759]" />
            </div>
            <p className="font-heading text-3xl font-black text-[#34C759]">
              {stats?.completed_workouts || 0}
            </p>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#737373] mt-1">
              Completed
            </p>
          </Card>

          <Card 
            data-testid="profile-stat-streak"
            className="bg-[#141414] border-white/10 p-6 text-center"
          >
            <div className="w-12 h-12 bg-[#FF3B30]/20 flex items-center justify-center mx-auto mb-3">
              <Flame className="w-6 h-6 text-[#FF3B30]" />
            </div>
            <p className="font-heading text-3xl font-black text-[#FF3B30]">
              {stats?.streak || 0}
            </p>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#737373] mt-1">
              Day Streak
            </p>
          </Card>

          <Card 
            data-testid="profile-stat-rate"
            className="bg-[#141414] border-white/10 p-6 text-center"
          >
            <div className="w-12 h-12 bg-[#FF9500]/20 flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-6 h-6 text-[#FF9500]" />
            </div>
            <p className="font-heading text-3xl font-black text-[#FF9500]">
              {stats?.completion_percentage || 0}%
            </p>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-[#737373] mt-1">
              Success Rate
            </p>
          </Card>
        </div>

        {/* Pie Chart */}
        <Card className="bg-[#141414] border-white/10 p-6">
          <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight mb-4 text-center">
            Workout Progress
          </h3>
          {stats?.total_workouts > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-[#A3A3A3] text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-[#737373]">Generate workouts to see your progress</p>
            </div>
          )}
        </Card>
      </div>

      {/* Achievements */}
      <Card className="bg-[#141414] border-white/10 p-6">
        <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight mb-6">
          Achievements
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {achievements.map((achievement) => (
            <div
              key={achievement.name}
              data-testid={`achievement-${achievement.name.toLowerCase().replace(/\s/g, '-')}`}
              className={`p-4 text-center border transition-all ${
                achievement.unlocked 
                  ? 'border-[#34C759]/50 bg-[#34C759]/5' 
                  : 'border-white/10 opacity-40'
              }`}
            >
              <div className={`w-12 h-12 mx-auto mb-3 flex items-center justify-center ${
                achievement.unlocked ? 'bg-[#34C759]/20' : 'bg-white/5'
              }`}>
                <achievement.icon className={`w-6 h-6 ${
                  achievement.unlocked ? 'text-[#34C759]' : 'text-[#737373]'
                }`} />
              </div>
              <p className={`text-sm font-semibold mb-1 ${
                achievement.unlocked ? 'text-white' : 'text-[#737373]'
              }`}>
                {achievement.name}
              </p>
              <p className="text-xs text-[#737373]">
                {achievement.description}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Account Actions */}
      <Card className="bg-[#141414] border-white/10 p-6">
        <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight mb-4">
          Account
        </h3>
        <Button
          variant="outline"
          onClick={handleLogout}
          data-testid="profile-logout-btn"
          className="border-[#FF3B30]/50 text-[#FF3B30] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] font-bold uppercase tracking-wider"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </Card>
    </div>
  );
};

export default ProfilePage;

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Mail, 
  Calendar,
  Dumbbell,
  CheckCircle2,
  Flame,
  Trophy,
  LogOut
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
          completion_percentage: 0
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

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#A3A3A3]">Loading profile...</div>
      </div>
    );
  }

  return (
    <div data-testid="profile-page" className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Profile Header */}
      <Card className="bg-[#141414] border-white/10 p-8">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 bg-[#007AFF] flex items-center justify-center text-white text-4xl font-heading font-black">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          
          {/* User Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-heading text-3xl font-black text-white uppercase tracking-tight">
              {user?.name}
            </h1>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-3 text-[#A3A3A3]">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span data-testid="user-email">{user?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Streak Badge */}
          {stats?.streak > 0 && (
            <div 
              data-testid="profile-streak-badge"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF3B30] to-[#FF9500]"
            >
              <Flame className="w-6 h-6 text-white" />
              <div className="text-white">
                <div className="font-bold text-2xl">{stats.streak}</div>
                <div className="text-xs uppercase tracking-wider opacity-80">Day Streak</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Account Actions */}
      <Card className="bg-[#141414] border-white/10 p-6">
        <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight mb-4">
          Account
        </h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            variant="outline"
            onClick={handleLogout}
            data-testid="profile-logout-btn"
            className="border-[#FF3B30]/50 text-[#FF3B30] hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] font-bold uppercase tracking-wider"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Achievements Placeholder */}
      <Card className="bg-[#141414] border-white/10 p-6">
        <h3 className="font-heading text-xl font-bold text-white uppercase tracking-tight mb-4">
          Achievements
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { name: 'First Workout', unlocked: (stats?.total_workouts || 0) >= 1, icon: '🏃' },
            { name: '10 Workouts', unlocked: (stats?.total_workouts || 0) >= 10, icon: '💪' },
            { name: '7 Day Streak', unlocked: (stats?.streak || 0) >= 7, icon: '🔥' },
            { name: '50% Completion', unlocked: (stats?.completion_percentage || 0) >= 50, icon: '🎯' },
          ].map((achievement) => (
            <div
              key={achievement.name}
              data-testid={`achievement-${achievement.name.toLowerCase().replace(/\s/g, '-')}`}
              className={`p-4 text-center border ${
                achievement.unlocked 
                  ? 'border-[#34C759]/50 bg-[#34C759]/5' 
                  : 'border-white/10 opacity-50'
              }`}
            >
              <div className="text-3xl mb-2">{achievement.icon}</div>
              <p className={`text-sm font-medium ${
                achievement.unlocked ? 'text-white' : 'text-[#737373]'
              }`}>
                {achievement.name}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default ProfilePage;

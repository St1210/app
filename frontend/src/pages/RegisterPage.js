import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Flame, Mail, Lock, User, ArrowRight, Target } from 'lucide-react';

const PROGRAM_TYPES = [
  { value: 'BEGINNER', label: 'Beginner - Just Starting', color: '#34C759' },
  { value: 'WEIGHT_LOSS', label: 'Weight Loss', color: '#FF3B30' },
  { value: 'MUSCLE', label: 'Build Muscle', color: '#007AFF' },
  { value: 'FLEXIBILITY', label: 'Flexibility & Mobility', color: '#AF52DE' },
  { value: 'HOME', label: 'Home Workouts', color: '#FF9500' },
  { value: 'REHAB', label: 'Recovery & Rehab', color: '#5AC8FA' },
];

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, fitnessGoal || null);
      toast.success('Account created! Welcome to HealthCoach!');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Left side - Hero Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.pexels.com/photos/136404/pexels-photo-136404.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/70 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center p-12">
          <h1 className="font-heading text-5xl font-black text-white uppercase tracking-tighter leading-none mb-4">
            Start Your<br />Journey
          </h1>
          <p className="text-[#A3A3A3] text-lg max-w-md">
            Join thousands of athletes who trust HealthCoach for their fitness transformation with AI-powered personalized workouts.
          </p>
        </div>
      </div>

      {/* Right side - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-[#007AFF] flex items-center justify-center">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <span className="font-heading text-2xl font-bold text-white tracking-tight uppercase">
              HealthCoach
            </span>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="font-heading text-3xl font-bold text-white uppercase tracking-tight mb-2">
              Create Account
            </h2>
            <p className="text-[#A3A3A3]">
              Start your fitness journey today
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white text-sm font-medium">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737373]" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  data-testid="register-name-input"
                  className="pl-11 bg-[#141414] border-white/10 text-white placeholder:text-[#737373] focus:border-[#007AFF] focus:ring-[#007AFF] h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737373]" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  data-testid="register-email-input"
                  className="pl-11 bg-[#141414] border-white/10 text-white placeholder:text-[#737373] focus:border-[#007AFF] focus:ring-[#007AFF] h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737373]" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create password"
                    required
                    data-testid="register-password-input"
                    className="pl-11 bg-[#141414] border-white/10 text-white placeholder:text-[#737373] focus:border-[#007AFF] focus:ring-[#007AFF] h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white text-sm font-medium">
                  Confirm
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737373]" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                    data-testid="register-confirm-password-input"
                    className="pl-11 bg-[#141414] border-white/10 text-white placeholder:text-[#737373] focus:border-[#007AFF] focus:ring-[#007AFF] h-12"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white text-sm font-medium">
                Fitness Goal <span className="text-[#737373]">(optional)</span>
              </Label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#737373] z-10" />
                <Select value={fitnessGoal} onValueChange={setFitnessGoal}>
                  <SelectTrigger 
                    data-testid="register-goal-select"
                    className="pl-11 h-12 bg-[#141414] border-white/10 text-white"
                  >
                    <SelectValue placeholder="Select your goal" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-white/10">
                    {PROGRAM_TYPES.map((type) => (
                      <SelectItem 
                        key={type.value} 
                        value={type.value}
                        className="text-white hover:bg-white/10 focus:bg-white/10"
                      >
                        <span style={{ color: type.color }}>{type.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="register-submit-btn"
              className="w-full h-12 bg-[#007AFF] hover:bg-[#005BB5] text-white font-bold uppercase tracking-wider transition-all active:scale-[0.98] mt-6"
            >
              {loading ? (
                'Creating account...'
              ) : (
                <>
                  Start Training
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          {/* Login Link */}
          <p className="mt-6 text-center text-[#A3A3A3]">
            Already have an account?{' '}
            <Link
              to="/login"
              data-testid="login-link"
              className="text-[#007AFF] hover:text-[#005BB5] font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

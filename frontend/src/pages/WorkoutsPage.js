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
  Dumbbell, 
  CheckCircle2, 
  Plus,
  Filter,
  Sparkles,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';

const PROGRAM_TYPES = [
  { value: 'BEGINNER', label: 'Beginner', color: '#34C759', description: 'Perfect for starting your fitness journey', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxob21lJTIwd29ya291dHxlbnwwfHx8fDE3NzQ1MzM2NTh8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'WEIGHT_LOSS', label: 'Weight Loss', color: '#FF3B30', description: 'High-intensity fat burning routines', image: 'https://images.unsplash.com/photo-1693214674477-1159bddf1598?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHw0fHxneW0lMjB3b3Jrb3V0JTIwZGFya3xlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'MUSCLE', label: 'Muscle Building', color: '#007AFF', description: 'Strength training for muscle growth', image: 'https://images.unsplash.com/photo-1603665409265-bdc00027c217?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxneW0lMjB3b3Jrb3V0JTIwZGFya3xlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'FLEXIBILITY', label: 'Flexibility', color: '#AF52DE', description: 'Yoga and stretching for mobility', image: 'https://images.unsplash.com/photo-1607909599990-e2c4778e546b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHx5b2dhJTIwc3RyZXRjaHxlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'HOME', label: 'Home Workout', color: '#FF9500', description: 'No equipment needed workouts', image: 'https://images.pexels.com/photos/6496120/pexels-photo-6496120.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
  { value: 'REHAB', label: 'Rehabilitation', color: '#5AC8FA', description: 'Recovery and injury prevention', image: 'https://images.unsplash.com/photo-1701824429192-74ad7c2246f0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHw0fHx5b2dhJTIwc3RyZXRjaHxlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
];

const WorkoutsPage = () => {
  const { user, updateGoal } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [planDays, setPlanDays] = useState('7');
  const [loading, setLoading] = useState(true);
  const [aiPlanResult, setAiPlanResult] = useState(null);
  const [expandedWorkout, setExpandedWorkout] = useState(null);
  const [useAI, setUseAI] = useState(true);

  useEffect(() => {
    fetchWorkouts();
    if (user?.fitness_goal) {
      setSelectedProgram(user.fitness_goal);
    }
  }, [user]);

  const fetchWorkouts = async () => {
    try {
      const res = await api.get('/workout/all');
      setWorkouts(res.data);
    } catch (error) {
      console.error('Failed to fetch workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWorkouts = async () => {
    if (!selectedProgram) {
      toast.error('Please select a program type');
      return;
    }

    setGenerating(true);
    setAiPlanResult(null);

    try {
      let response;
      if (useAI) {
        // AI-powered generation
        response = await api.post('/workout/ai-plan', {
          program_type: selectedProgram,
          days: parseInt(planDays)
        });
        setAiPlanResult({
          coach_message: response.data.coach_message,
          recommended_intensity: response.data.recommended_intensity,
          weekly_schedule: response.data.weekly_schedule
        });
        setWorkouts(prev => [...response.data.workouts, ...prev]);
        toast.success(`AI generated ${response.data.workouts.length} personalized workouts!`);
      } else {
        // Standard generation
        response = await api.post(`/workout/generate/${selectedProgram}`);
        setWorkouts(prev => [...response.data, ...prev]);
        toast.success(`Generated ${response.data.length} new workouts!`);
      }

      // Update user's fitness goal
      if (user?.fitness_goal !== selectedProgram) {
        await updateGoal(selectedProgram);
      }
    } catch (error) {
      toast.error('Failed to generate workouts');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const toggleComplete = async (workoutId) => {
    try {
      const res = await api.put(`/workout/complete/${workoutId}`);
      setWorkouts(prev => 
        prev.map(w => w.id === workoutId ? res.data : w)
      );
      toast.success(res.data.completed ? 'Great work! Workout completed!' : 'Workout unmarked');
    } catch (error) {
      toast.error('Failed to update workout');
    }
  };

  const filteredWorkouts = workouts.filter(w => {
    if (filter === 'all') return true;
    if (filter === 'completed') return w.completed;
    if (filter === 'pending') return !w.completed;
    if (filter === 'ai') return w.ai_generated;
    return w.program_type === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#A3A3A3]">Loading workouts...</div>
      </div>
    );
  }

  return (
    <div data-testid="workouts-page" className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Workouts
          </h1>
          <p className="text-[#A3A3A3] mt-1">
            Generate AI-powered workout plans tailored to your progress
          </p>
        </div>
      </div>

      {/* Program Type Selection */}
      <div>
        <h3 className="font-heading text-lg font-bold text-white uppercase tracking-tight mb-4">
          Select Your Goal
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {PROGRAM_TYPES.map((type) => (
            <Card
              key={type.value}
              data-testid={`program-card-${type.value.toLowerCase()}`}
              className={`bg-[#141414] border-white/10 overflow-hidden cursor-pointer transition-all hover:border-white/20 hover:scale-[1.02] ${
                selectedProgram === type.value ? 'ring-2 ring-[#007AFF] border-[#007AFF]' : ''
              }`}
              onClick={() => setSelectedProgram(type.value)}
            >
              <div 
                className="h-24 bg-cover bg-center relative"
                style={{ backgroundImage: `url('${type.image}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent" />
                {selectedProgram === type.value && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-[#007AFF] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p 
                  className="font-semibold text-sm"
                  style={{ color: type.color }}
                >
                  {type.label}
                </p>
                <p className="text-[#737373] text-xs mt-1 line-clamp-1">
                  {type.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Generation Controls */}
      <Card className="bg-[#141414] border-white/10 p-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="text-sm text-[#A3A3A3] mb-2 block">Plan Duration</label>
            <Select value={planDays} onValueChange={setPlanDays}>
              <SelectTrigger 
                data-testid="plan-days-select"
                className="w-full lg:w-[200px] bg-[#0A0A0A] border-white/10 text-white"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                <SelectItem value="3" className="text-white hover:bg-white/10">3 Days</SelectItem>
                <SelectItem value="5" className="text-white hover:bg-white/10">5 Days</SelectItem>
                <SelectItem value="7" className="text-white hover:bg-white/10">7 Days (Week)</SelectItem>
                <SelectItem value="14" className="text-white hover:bg-white/10">14 Days (2 Weeks)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="w-4 h-4 accent-[#007AFF]"
                data-testid="use-ai-checkbox"
              />
              <span className="text-sm text-[#A3A3A3]">AI Personalization</span>
              <Sparkles className="w-4 h-4 text-[#007AFF]" />
            </label>
          </div>

          <Button
            onClick={generateWorkouts}
            disabled={generating || !selectedProgram}
            data-testid="generate-workout-btn"
            className="bg-[#007AFF] hover:bg-[#005BB5] text-white font-bold uppercase tracking-wider px-8 py-6"
          >
            {generating ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                {useAI ? <Sparkles className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Generate {planDays}-Day Plan
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* AI Plan Result */}
      {aiPlanResult && (
        <Card 
          data-testid="ai-plan-result"
          className="bg-gradient-to-r from-[#007AFF]/10 to-[#34C759]/10 border-[#007AFF]/30 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#007AFF] flex items-center justify-center shrink-0">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-lg font-bold text-[#007AFF] uppercase tracking-tight mb-2">
                Coach's Recommendation
              </h3>
              <p className="text-white text-lg font-medium mb-3">
                "{aiPlanResult.coach_message}"
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FF9500]" />
                  <span className="text-[#A3A3A3]">
                    Intensity: <span className="text-white font-medium">{aiPlanResult.recommended_intensity}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#34C759]" />
                  <span className="text-[#A3A3A3]">{aiPlanResult.weekly_schedule}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-[#737373]" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger 
              data-testid="filter-select"
              className="w-[180px] bg-[#141414] border-white/10 text-white"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#141414] border-white/10">
              <SelectItem value="all" className="text-white hover:bg-white/10">All Workouts</SelectItem>
              <SelectItem value="completed" className="text-white hover:bg-white/10">Completed</SelectItem>
              <SelectItem value="pending" className="text-white hover:bg-white/10">Pending</SelectItem>
              <SelectItem value="ai" className="text-white hover:bg-white/10">AI Generated</SelectItem>
              {PROGRAM_TYPES.map((type) => (
                <SelectItem 
                  key={type.value} 
                  value={type.value}
                  className="text-white hover:bg-white/10"
                >
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-[#737373] text-sm">
          {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Workouts List */}
      {filteredWorkouts.length === 0 ? (
        <Card className="bg-[#141414] border-white/10 p-12 text-center">
          <Sparkles className="w-16 h-16 text-[#007AFF] mx-auto mb-4" />
          <h3 className="font-heading text-xl font-bold text-white uppercase mb-2">
            No Workouts Found
          </h3>
          <p className="text-[#A3A3A3] mb-6">
            {filter !== 'all' 
              ? 'Try changing your filter or generate new workouts'
              : 'Select a program above and generate your first AI-powered workout plan'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((workout, index) => {
            const programType = PROGRAM_TYPES.find(p => p.value === workout.program_type);
            const isExpanded = expandedWorkout === workout.id;
            
            return (
              <Card
                key={workout.id}
                data-testid={`workout-card-${workout.id}`}
                className={`bg-[#141414] border-white/10 overflow-hidden transition-all ${
                  workout.completed ? 'border-[#34C759]/50' : ''
                }`}
              >
                <div 
                  className="p-5 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedWorkout(isExpanded ? null : workout.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComplete(workout.id);
                        }}
                        data-testid={`toggle-complete-${workout.id}`}
                        className={`w-12 h-12 flex items-center justify-center shrink-0 transition-all ${
                          workout.completed 
                            ? 'bg-[#34C759]/20 hover:bg-[#34C759]/30' 
                            : 'bg-[#1A1A1A] hover:bg-[#252525]'
                        }`}
                      >
                        {workout.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-[#34C759]" />
                        ) : (
                          <div className="w-6 h-6 border-2 border-[#737373]" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-semibold text-lg ${
                            workout.completed ? 'text-[#34C759]' : 'text-white'
                          }`}>
                            {workout.title}
                          </h4>
                          {workout.ai_generated && (
                            <Sparkles className="w-4 h-4 text-[#007AFF]" />
                          )}
                        </div>
                        <p className="text-[#A3A3A3] text-sm mt-1 line-clamp-1">
                          {workout.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#737373]" />
                        <span className="text-[#A3A3A3] text-sm">{workout.duration_mins || 30} min</span>
                      </div>
                      <span 
                        className="program-badge hidden sm:inline-block"
                        style={{ 
                          backgroundColor: `${programType?.color}20`,
                          color: programType?.color 
                        }}
                      >
                        {workout.program_type.replace('_', ' ')}
                      </span>
                      <span className="text-[#737373] text-sm font-mono hidden sm:inline">
                        {workout.date}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[#737373]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#737373]" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-white/10 mt-0">
                    <div className="pt-4 space-y-4">
                      <div>
                        <h5 className="text-sm font-bold text-[#A3A3A3] uppercase tracking-wider mb-2">
                          Instructions
                        </h5>
                        <p className="text-white">{workout.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[#FF9500]" />
                          <span className="text-sm text-[#A3A3A3]">
                            Intensity: <span className="text-white">{workout.intensity || 'MEDIUM'}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#34C759]" />
                          <span className="text-sm text-[#A3A3A3]">
                            Duration: <span className="text-white">{workout.duration_mins || 30} minutes</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span 
                            className="program-badge sm:hidden"
                            style={{ 
                              backgroundColor: `${programType?.color}20`,
                              color: programType?.color 
                            }}
                          >
                            {workout.program_type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkoutsPage;

import { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const PROGRAM_TYPES = [
  { value: 'BEGINNER', label: 'Beginner', color: '#34C759', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxob21lJTIwd29ya291dHxlbnwwfHx8fDE3NzQ1MzM2NTh8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'WEIGHT_LOSS', label: 'Weight Loss', color: '#FF3B30', image: 'https://images.unsplash.com/photo-1693214674477-1159bddf1598?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHw0fHxneW0lMjB3b3Jrb3V0JTIwZGFya3xlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'MUSCLE', label: 'Muscle Building', color: '#007AFF', image: 'https://images.unsplash.com/photo-1603665409265-bdc00027c217?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxneW0lMjB3b3Jrb3V0JTIwZGFya3xlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'FLEXIBILITY', label: 'Flexibility', color: '#AF52DE', image: 'https://images.unsplash.com/photo-1607909599990-e2c4778e546b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHx5b2dhJTIwc3RyZXRjaHxlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
  { value: 'HOME', label: 'Home Workout', color: '#FF9500', image: 'https://images.pexels.com/photos/6496120/pexels-photo-6496120.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
  { value: 'REHAB', label: 'Rehabilitation', color: '#5AC8FA', image: 'https://images.unsplash.com/photo-1701824429192-74ad7c2246f0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHw0fHx5b2dhJTIwc3RyZXRjaHxlbnwwfHx8fDE3NzQ1MzM2NTd8MA&ixlib=rb-4.1.0&q=85&w=400' },
];

const WorkoutsPage = () => {
  const [workouts, setWorkouts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkouts();
  }, []);

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

  const generateWorkouts = async (programType) => {
    if (!programType) {
      toast.error('Please select a program type');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post(`/workout/generate/${programType}`);
      setWorkouts(prev => [...res.data, ...prev]);
      toast.success(`Generated ${res.data.length} new workouts!`);
      setSelectedProgram('');
    } catch (error) {
      toast.error('Failed to generate workouts');
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
      toast.success(res.data.completed ? 'Workout completed!' : 'Workout unmarked');
    } catch (error) {
      toast.error('Failed to update workout');
    }
  };

  const filteredWorkouts = workouts.filter(w => {
    if (filter === 'all') return true;
    if (filter === 'completed') return w.completed;
    if (filter === 'pending') return !w.completed;
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Workouts
          </h1>
          <p className="text-[#A3A3A3] mt-1">
            Generate and track your fitness routines
          </p>
        </div>

        {/* Generate Workout Section */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger 
              data-testid="program-type-select"
              className="w-full sm:w-[200px] bg-[#141414] border-white/10 text-white"
            >
              <SelectValue placeholder="Select program" />
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
          <Button
            onClick={() => generateWorkouts(selectedProgram)}
            disabled={generating || !selectedProgram}
            data-testid="generate-workout-btn"
            className="bg-[#007AFF] hover:bg-[#005BB5] text-white font-bold uppercase tracking-wider"
          >
            {generating ? (
              'Generating...'
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Program Type Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {PROGRAM_TYPES.map((type) => (
          <Card
            key={type.value}
            data-testid={`program-card-${type.value.toLowerCase()}`}
            className={`bg-[#141414] border-white/10 overflow-hidden cursor-pointer transition-all hover:border-white/20 hover:scale-[1.02] ${
              selectedProgram === type.value ? 'ring-2 ring-[#007AFF]' : ''
            }`}
            onClick={() => setSelectedProgram(type.value)}
          >
            <div 
              className="h-24 bg-cover bg-center relative"
              style={{ backgroundImage: `url('${type.image}')` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent" />
            </div>
            <div className="p-3">
              <p 
                className="font-semibold text-sm truncate"
                style={{ color: type.color }}
              >
                {type.label}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter */}
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
            <SelectItem value="all" className="text-white hover:bg-white/10 focus:bg-white/10">All Workouts</SelectItem>
            <SelectItem value="completed" className="text-white hover:bg-white/10 focus:bg-white/10">Completed</SelectItem>
            <SelectItem value="pending" className="text-white hover:bg-white/10 focus:bg-white/10">Pending</SelectItem>
            {PROGRAM_TYPES.map((type) => (
              <SelectItem 
                key={type.value} 
                value={type.value}
                className="text-white hover:bg-white/10 focus:bg-white/10"
              >
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[#737373] text-sm">
          {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Workouts List */}
      {filteredWorkouts.length === 0 ? (
        <Card className="bg-[#141414] border-white/10 p-12 text-center">
          <Dumbbell className="w-16 h-16 text-[#737373] mx-auto mb-4" />
          <h3 className="font-heading text-xl font-bold text-white uppercase mb-2">
            No Workouts Found
          </h3>
          <p className="text-[#A3A3A3] mb-6">
            {filter !== 'all' 
              ? 'Try changing your filter or generate new workouts'
              : 'Generate your first workout plan to get started'}
          </p>
          <Button
            onClick={() => {
              setFilter('all');
              setSelectedProgram('BEGINNER');
            }}
            data-testid="get-started-btn"
            className="bg-[#007AFF] hover:bg-[#005BB5] text-white font-bold uppercase"
          >
            <Plus className="w-4 h-4 mr-2" />
            Get Started
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((workout, index) => {
            const programType = PROGRAM_TYPES.find(p => p.value === workout.program_type);
            return (
              <Card
                key={workout.id}
                data-testid={`workout-card-${workout.id}`}
                className={`bg-[#141414] border-white/10 p-5 hover:border-white/20 transition-all ${
                  workout.completed ? 'border-[#34C759]/50' : ''
                }`}
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'backwards'
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <button
                      onClick={() => toggleComplete(workout.id)}
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
                      <h4 className={`font-semibold text-lg ${
                        workout.completed ? 'text-[#34C759] line-through' : 'text-white'
                      }`}>
                        {workout.title}
                      </h4>
                      <p className="text-[#A3A3A3] text-sm mt-1 line-clamp-2">
                        {workout.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <span 
                      className="program-badge"
                      style={{ 
                        backgroundColor: `${programType?.color}20`,
                        color: programType?.color 
                      }}
                    >
                      {workout.program_type.replace('_', ' ')}
                    </span>
                    <span className="text-[#737373] text-sm font-mono">
                      {workout.date}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkoutsPage;

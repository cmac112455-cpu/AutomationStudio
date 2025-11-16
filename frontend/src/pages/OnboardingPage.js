import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Building2, Lightbulb, ArrowRight, Check } from 'lucide-react';

export default function OnboardingPage() {
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState('existing');
  const [formData, setFormData] = useState({
    business_name: '',
    industry: '',
    description: '',
    target_audience: '',
    products_services: '',
    business_idea: '',
    desired_industry: '',
    goals: '',
    ad_copy_library: []
  });
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step === 1 && !businessType) {
      toast.error('Please select a business type');
      return;
    }
    setStep(step + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const profileData = {
        business_type: businessType,
        ...formData
      };

      await axios.post('/profile', profileData);
      
      setUser(prev => ({ ...prev, profile_completed: true }));
      toast.success('Profile created successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Step {step} of 3</span>
            <span className="text-sm text-[#00d4ff]">{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="h-2 bg-[#1a1d2e] rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#00d4ff] to-[#4785ff] transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        <div className="glass-morph rounded-2xl p-8 shadow-2xl">
          <h1 className="text-3xl font-bold mb-2" data-testid="onboarding-title">
            Let's Set Up Your Business Profile
          </h1>
          <p className="text-gray-400 mb-8">
            This helps us personalize your AI Co-Pilot experience
          </p>

          {/* Step 1: Business Type Selection */}
          {step === 1 && (
            <div className="space-y-6" data-testid="business-type-step">
              <h2 className="text-xl font-semibold mb-4">Choose Your Business Stage</h2>
              <RadioGroup value={businessType} onValueChange={setBusinessType}>
                <div 
                  className={`glass-morph p-6 rounded-xl cursor-pointer card-hover ${
                    businessType === 'existing' ? 'ring-2 ring-[#00d4ff]' : ''
                  }`}
                  onClick={() => setBusinessType('existing')}
                  data-testid="existing-business-option"
                >
                  <div className="flex items-start gap-4">
                    <RadioGroupItem value="existing" id="existing" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="w-6 h-6 text-[#00d4ff]" />
                        <Label htmlFor="existing" className="text-lg font-semibold cursor-pointer">
                          I Own an Existing Business
                        </Label>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Already running a business and looking to optimize operations and boost profits
                      </p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`glass-morph p-6 rounded-xl cursor-pointer card-hover ${
                    businessType === 'starting' ? 'ring-2 ring-[#00d4ff]' : ''
                  }`}
                  onClick={() => setBusinessType('starting')}
                  data-testid="starting-business-option"
                >
                  <div className="flex items-start gap-4">
                    <RadioGroupItem value="starting" id="starting" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Lightbulb className="w-6 h-6 text-[#4785ff]" />
                        <Label htmlFor="starting" className="text-lg font-semibold cursor-pointer">
                          I'm Starting a New Business
                        </Label>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Have a business idea and need guidance to launch and scale fast
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>

              <Button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90 text-white font-semibold py-6 mt-6"
                data-testid="next-button"
              >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Step 2: Business Details (Existing Business) */}
          {step === 2 && businessType === 'existing' && (
            <div className="space-y-4" data-testid="existing-business-form">
              <h2 className="text-xl font-semibold mb-4">Tell Us About Your Business</h2>
              
              <div>
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  value={formData.business_name}
                  onChange={(e) => updateField('business_name', e.target.value)}
                  placeholder="Acme Corporation"
                  className="bg-[#1a1d2e] border-gray-700 text-white"
                  required
                  data-testid="business-name-input"
                />
              </div>

              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => updateField('industry', e.target.value)}
                  placeholder="E-commerce, SaaS, Consulting, etc."
                  className="bg-[#1a1d2e] border-gray-700 text-white"
                  required
                  data-testid="industry-input"
                />
              </div>

              <div>
                <Label htmlFor="description">Business Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="What does your business do?"
                  className="bg-[#1a1d2e] border-gray-700 text-white min-h-24"
                  required
                  data-testid="description-input"
                />
              </div>

              <div>
                <Label htmlFor="target_audience">Target Audience</Label>
                <Input
                  id="target_audience"
                  value={formData.target_audience}
                  onChange={(e) => updateField('target_audience', e.target.value)}
                  placeholder="Who are your ideal customers?"
                  className="bg-[#1a1d2e] border-gray-700 text-white"
                  required
                  data-testid="target-audience-input"
                />
              </div>

              <div>
                <Label htmlFor="products_services">Products/Services</Label>
                <Textarea
                  id="products_services"
                  value={formData.products_services}
                  onChange={(e) => updateField('products_services', e.target.value)}
                  placeholder="What do you sell?"
                  className="bg-[#1a1d2e] border-gray-700 text-white min-h-24"
                  required
                  data-testid="products-services-input"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 border-gray-700 hover:bg-[#1a1d2e]"
                  data-testid="back-button"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90 text-white font-semibold"
                  data-testid="next-button-step2"
                >
                  Continue <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Business Details (Starting Business) */}
          {step === 2 && businessType === 'starting' && (
            <div className="space-y-4" data-testid="starting-business-form">
              <h2 className="text-xl font-semibold mb-4">Tell Us About Your Business Idea</h2>
              
              <div>
                <Label htmlFor="business_idea">Business Idea</Label>
                <Textarea
                  id="business_idea"
                  value={formData.business_idea}
                  onChange={(e) => updateField('business_idea', e.target.value)}
                  placeholder="e.g., AI marketing agency, property contract flipping, AI website agency"
                  className="bg-[#1a1d2e] border-gray-700 text-white min-h-24"
                  required
                  data-testid="business-idea-input"
                />
              </div>

              <div>
                <Label htmlFor="desired_industry">Desired Industry</Label>
                <Input
                  id="desired_industry"
                  value={formData.desired_industry}
                  onChange={(e) => updateField('desired_industry', e.target.value)}
                  placeholder="AI services, real estate, web development, etc."
                  className="bg-[#1a1d2e] border-gray-700 text-white"
                  required
                  data-testid="desired-industry-input"
                />
              </div>

              <div>
                <Label htmlFor="goals">Your Goals</Label>
                <Textarea
                  id="goals"
                  value={formData.goals}
                  onChange={(e) => updateField('goals', e.target.value)}
                  placeholder="What do you want to achieve with this business?"
                  className="bg-[#1a1d2e] border-gray-700 text-white min-h-24"
                  required
                  data-testid="goals-input"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 border-gray-700 hover:bg-[#1a1d2e]"
                  data-testid="back-button-step2"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1 bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90 text-white font-semibold"
                  data-testid="next-button-starting"
                >
                  Continue <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Data Connection Wizard */}
          {step === 3 && (
            <div className="space-y-6" data-testid="connection-step">
              <h2 className="text-xl font-semibold mb-4">Connect Your Data Sources</h2>
              <p className="text-gray-400 mb-6">
                Connect your business data sources for real-time insights (Optional - can be done later)
              </p>

              <div className="space-y-4">
                <div className="glass-morph p-6 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold">M</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">Meta Ads Account</h3>
                      <p className="text-sm text-gray-400">Track ad performance in real-time</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-gray-700" disabled data-testid="connect-meta-button">
                    Coming Soon
                  </Button>
                </div>

                <div className="glass-morph p-6 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <span className="text-white font-bold">$</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">Financial Data</h3>
                      <p className="text-sm text-gray-400">Import revenue and expense data</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-gray-700" disabled data-testid="connect-financial-button">
                    Coming Soon
                  </Button>
                </div>

                <div className="glass-morph p-6 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <span className="text-white font-bold">@</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">Communication Channels</h3>
                      <p className="text-sm text-gray-400">Instagram, Twitter, Email</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-gray-700" disabled data-testid="connect-communication-button">
                    Coming Soon
                  </Button>
                </div>
              </div>

              <div className="bg-[#4785ff]/10 border border-[#4785ff]/30 rounded-xl p-4 mt-6">
                <p className="text-sm text-[#4785ff] flex items-start gap-2">
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>You can connect these data sources later from your dashboard settings. For now, we'll use simulated data to show you how APOE works.</span>
                </p>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="flex-1 border-gray-700 hover:bg-[#1a1d2e]"
                  data-testid="back-button-step3"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90 text-white font-semibold"
                  disabled={loading}
                  data-testid="complete-button"
                >
                  {loading ? 'Setting up...' : 'Complete Setup'} <Check className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useRef, useEffect } from 'react';
import { ChevronDownIcon, CpuChipIcon, CloudIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useUIStore, selectAIState, type IAIModel } from '../stores/ui-store';

interface AIModelSelectorProps {
  className?: string;
}

export const AIModelSelector: React.FC<AIModelSelectorProps> = ({ className = '' }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    selectedModel,
    availableModels,
    dropdownOpen,
    naturalLanguageEnabled,
    aiSuggestionsEnabled,
  } = useUIStore(selectAIState);
  
  const setSelectedAIModel = useUIStore((state) => state.setSelectedAIModel);
  const setAIModelDropdownOpen = useUIStore((state) => state.setAIModelDropdownOpen);
  const setNaturalLanguageEnabled = useUIStore((state) => state.setNaturalLanguageEnabled);
  const setAISuggestionsEnabled = useUIStore((state) => state.setAISuggestionsEnabled);

  const selectedModelData = availableModels.find(m => m.id === selectedModel);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAIModelDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleModelSelect = (modelId: string) => {
    setSelectedAIModel(modelId);
    setAIModelDropdownOpen(false);
  };

  const getProviderIcon = (provider: IAIModel['provider']) => {
    switch (provider) {
      case 'local':
        return <CpuChipIcon className="w-4 h-4" />;
      default:
        return <CloudIcon className="w-4 h-4" />;
    }
  };

  const getProviderColor = (provider: IAIModel['provider']) => {
    switch (provider) {
      case 'openai':
        return 'text-green-400';
      case 'anthropic':
        return 'text-orange-400';
      case 'google':
        return 'text-blue-400';
      case 'deepseek':
        return 'text-purple-400';
      case 'qwen':
        return 'text-red-400';
      case 'local':
        return 'text-portal-primary';
      default:
        return 'text-gray-400';
    }
  };

  const getSpeedBadge = (speed: number) => {
    if (speed >= 50) return { color: 'bg-green-500/20 text-green-400', text: 'Fast' };
    if (speed >= 30) return { color: 'bg-yellow-500/20 text-yellow-400', text: 'Medium' };
    return { color: 'bg-red-500/20 text-red-400', text: 'Slow' };
  };

  const groupedModels = availableModels.reduce((groups, model) => {
    const key = model.provider === 'local' ? 'Local Models' : 'External Providers';
    if (!groups[key]) groups[key] = [];
    groups[key].push(model);
    return groups;
  }, {} as Record<string, IAIModel[]>);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setAIModelDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-portal-card/50 hover:bg-portal-card 
                   border border-portal-border rounded-lg transition-colors text-sm"
        aria-label="Select AI Model"
      >
        <div className="flex items-center gap-2">
          <div className={getProviderColor(selectedModelData?.provider || 'openai')}>
            {getProviderIcon(selectedModelData?.provider || 'openai')}
          </div>
          <span className="text-portal-text-primary font-medium">
            {selectedModelData?.displayName || 'Select Model'}
          </span>
        </div>
        <ChevronDownIcon 
          className={`w-4 h-4 text-portal-text-secondary transition-transform ${
            dropdownOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-portal-card border border-portal-border 
                        rounded-xl shadow-xl z-50 overflow-hidden">
          
          {/* Settings Header */}
          <div className="p-4 border-b border-portal-border">
            <h3 className="text-sm font-semibold text-portal-text-primary mb-3">AI Assistant Settings</h3>
            
            {/* Natural Language Toggle */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm text-portal-text-primary">Natural Language Detection</span>
                <p className="text-xs text-portal-text-secondary">
                  Toggle on / off natural language detection in command line input
                </p>
              </div>
              <button
                onClick={() => setNaturalLanguageEnabled(!naturalLanguageEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  naturalLanguageEnabled ? 'bg-portal-primary' : 'bg-portal-muted'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    naturalLanguageEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* AI Suggestions Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-portal-text-primary">AI Suggestions</span>
                <p className="text-xs text-portal-text-secondary">
                  Show intelligent suggestions as you type
                </p>
              </div>
              <button
                onClick={() => setAISuggestionsEnabled(!aiSuggestionsEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  aiSuggestionsEnabled ? 'bg-portal-primary' : 'bg-portal-muted'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    aiSuggestionsEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Model List */}
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(groupedModels).map(([groupName, models]) => (
              <div key={groupName}>
                <div className="px-4 py-2 bg-portal-muted/30">
                  <h4 className="text-xs font-semibold text-portal-text-secondary uppercase tracking-wider">
                    {groupName}
                  </h4>
                </div>
                
                {models.map((model) => {
                  const isSelected = selectedModel === model.id;
                  const speedBadge = model.estimatedSpeed ? getSpeedBadge(model.estimatedSpeed) : null;
                  
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      disabled={!model.available}
                      className={`w-full px-4 py-3 flex items-center justify-between hover:bg-portal-muted/20 
                                transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isSelected ? 'bg-portal-primary/10' : ''
                                }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={getProviderColor(model.provider)}>
                          {getProviderIcon(model.provider)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-portal-text-primary truncate">
                              {model.displayName}
                            </span>
                            {!model.available && (
                              <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full">
                                Download Required
                              </span>
                            )}
                          </div>
                          
                          {model.description && (
                            <p className="text-xs text-portal-text-secondary truncate">
                              {model.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2 mt-1">
                            {model.contextLength && (
                              <span className="text-xs text-portal-text-secondary">
                                {model.contextLength.toLocaleString()} tokens
                              </span>
                            )}
                            {speedBadge && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${speedBadge.color}`}>
                                {speedBadge.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <CheckIcon className="w-4 h-4 text-portal-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
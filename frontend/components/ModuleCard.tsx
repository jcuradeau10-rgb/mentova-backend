import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ModuleCardProps {
  title: string;
  description: string;
  level: string;
  duration: string;
  lessonsCount: number;
  completedCount: number;
  onPress: () => void;
}

export default function ModuleCard({ 
  title, 
  description, 
  level, 
  duration, 
  lessonsCount, 
  completedCount,
  onPress 
}: ModuleCardProps) {
  const progress = lessonsCount > 0 ? (completedCount / lessonsCount) * 100 : 0;
  const isCompleted = completedCount === lessonsCount && lessonsCount > 0;

  const getLevelColor = () => {
    switch (level) {
      case 'beginner': return '#00D9A5';
      case 'intermediate': return '#7C3AED';
      case 'advanced': return '#FF6B35';
      default: return '#00D9A5';
    }
  };

  const getLevelText = () => {
    switch (level) {
      case 'beginner': return 'Débutant';
      case 'intermediate': return 'Intermédiaire';
      case 'advanced': return 'Avancé';
      default: return level;
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={[styles.levelBadge, { backgroundColor: `${getLevelColor()}20` }]}>
          <Text style={[styles.levelText, { color: getLevelColor() }]}>{getLevelText()}</Text>
        </View>
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#00D9A5" />
          </View>
        )}
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description} numberOfLines={2}>{description}</Text>
      
      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color="#8B8B9E" />
          <Text style={styles.metaText}>{duration}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="book-outline" size={14} color="#8B8B9E" />
          <Text style={styles.metaText}>{completedCount}/{lessonsCount} leçons</Text>
        </View>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: getLevelColor() }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A4E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 217, 165, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: '#8B8B9E',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    color: '#8B8B9E',
    fontSize: 13,
    marginLeft: 6,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#2A2A4E',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

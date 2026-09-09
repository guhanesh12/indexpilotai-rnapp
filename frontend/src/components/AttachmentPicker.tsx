import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
// Use legacy API to avoid deprecation warnings (getInfoAsync and readAsStringAsync)
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../lib/theme';

export interface SelectedFile {
  name: string;
  type: string;
  size: number;
  base64: string;
  uri: string;
}

interface AttachmentPickerProps {
  onFilesChange: (files: SelectedFile[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
}

// Allowed MIME types for uploads
const ALLOWED_PREFIXES = [
  'image/',
  'video/',
  'application/pdf',
  'audio/',
  'text/',
  'application/zip',
];

function isAllowedType(mimeType: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType === 'application/pdf') return 'document-text';
  if (mimeType.startsWith('audio/')) return 'musical-note';
  return 'document';
}

export function AttachmentPicker({
  onFilesChange,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024,
}: AttachmentPickerProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [loading, setLoading] = useState(false);
  // Track previous files to detect changes and avoid unnecessary callbacks
  const prevFilesRef = useRef<string>('');

  // Defer the onFilesChange callback to run after render to avoid "setState during render" error
  useEffect(() => {
    const currentFilesStr = JSON.stringify(selectedFiles);
    if (prevFilesRef.current !== currentFilesStr) {
      prevFilesRef.current = currentFilesStr;
      // Use setTimeout to defer the callback to the next tick, after render completes
      const timeoutId = setTimeout(() => {
        onFilesChange(selectedFiles);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedFiles, onFilesChange]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => {
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const addFiles = useCallback(async (newFiles: SelectedFile[]) => {
    const totalFiles = selectedFiles.length + newFiles.length;
    if (totalFiles > maxFiles) {
      Alert.alert('Limit Reached', `Maximum ${maxFiles} files allowed per ticket.`);
      return;
    }

    for (const file of newFiles) {
      if (file.size > maxSizeBytes) {
        Alert.alert(
          'File Too Large',
          `${file.name} exceeds ${formatFileSize(maxSizeBytes)} limit.`
        );
        return;
      }
    }

    setSelectedFiles((prev) => {
      return [...prev, ...newFiles];
    });
  }, [selectedFiles.length, maxFiles, maxSizeBytes]);

  const processFileFromUri = async (uri: string, fileName?: string, mimeType?: string): Promise<SelectedFile | null> => {
    try {
const info = await FileSystem.getInfoAsync(uri);
      const size = info.exists ? (info as any).size || 0 : 0;
      
const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64' as const,
      });

      const finalMimeType = mimeType || 'application/octet-stream';
      const finalName = fileName || `file_${Date.now()}`;

      return {
        name: finalName,
        type: finalMimeType,
        size: base64.length * 0.75,
        base64,
        uri,
      };
    } catch (error) {
      console.error('Error processing file:', error);
      return null;
    }
  };

const pickFromLibrary = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.6, // Reduced quality for better compression
        selectionLimit: maxFiles - selectedFiles.length,
      });

      if (result.canceled || !result.assets) return;

      setLoading(true);
      const processedFiles: SelectedFile[] = [];
      const timestamp = Date.now();

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        // Generate unique name with timestamp and index to avoid duplicates
        const uniqueName = `img_${timestamp}_${i + 1}.${asset.fileName?.split('.').pop() || 'jpg'}`;
        const file = await processFileFromUri(
          asset.uri,
          uniqueName,
          asset.mimeType || 'image/jpeg'
        );
        if (file) processedFiles.push(file);
      }

      await addFiles(processedFiles);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }, [maxFiles, selectedFiles.length, addFiles, processFileFromUri]);

const pickFromCamera = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow camera access.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.6, // Reduced quality for compression
      });

      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);
      const asset = result.assets[0];
      // Generate unique name with timestamp
      const uniqueName = `camera_${Date.now()}.${asset.fileName?.split('.').pop() || 'jpg'}`;
      const file = await processFileFromUri(
        asset.uri,
        uniqueName,
        asset.mimeType || 'image/jpeg'
      );

      if (file) await addFiles([file]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }, [addFiles, processFileFromUri]);

const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['*/*'],
      });

      if (result.canceled || !result.assets?.length) return;

      setLoading(true);
      const processedFiles: SelectedFile[] = [];

      // Handle the new v13 API - assets is an array
      const selectedDocs = result.assets || [];
      const docsToProcess = selectedDocs.slice(0, maxFiles - selectedFiles.length);

      for (const file of docsToProcess) {
        const mimeType = file.mimeType || 'application/octet-stream';
        if (!isAllowedType(mimeType)) {
          Alert.alert('Unsupported', `${file.name} has unsupported file type.`);
          continue;
        }

        const processed = await processFileFromUri(file.uri, file.name, mimeType);
        if (processed) processedFiles.push(processed);
      }

      await addFiles(processedFiles);
    } catch (error: any) {
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [maxFiles, selectedFiles.length, addFiles, processFileFromUri]);

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={pickFromLibrary}
          disabled={loading || selectedFiles.length >= maxFiles}
        >
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Photo/Video</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={pickFromCamera}
          disabled={loading || selectedFiles.length >= maxFiles}
        >
          <Text style={styles.actionIcon}>📸</Text>
          <Text style={styles.actionLabel}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={pickDocument}
          disabled={loading || selectedFiles.length >= maxFiles}
        >
          <Text style={styles.actionIcon}>📎</Text>
          <Text style={styles.actionLabel}>File</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Reading file...</Text>
        </View>
      )}

      {selectedFiles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filesScroll}
          contentContainerStyle={styles.filesContainer}
        >
{selectedFiles.map((file, index) => (
            <View key={`${file.name}-${index}`} style={styles.fileChip}>
              {file.type.startsWith('image/') ? (
                <Image source={{ uri: file.uri }} style={styles.thumbnail} />
              ) : (
                <View style={styles.fileIconContainer}>
                  <Ionicons
                    name={getFileIcon(file.type)}
                    size={20}
                    color={colors.brand.primary}
                  />
                </View>
              )}
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeFile(index)}
              >
                <Ionicons name="close" size={16} color="#FF3344" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Text style={styles.infoText}>
        {selectedFiles.length}/{maxFiles} files • Max {formatFileSize(maxSizeBytes)} each
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.base,
  },
  actionButton: {
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    minWidth: 90,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  filesScroll: {
    maxHeight: 80,
  },
  filesContainer: {
    gap: spacing.sm,
    paddingRight: spacing.base,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    paddingRight: spacing.xs,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: radius.sm,
  },
  fileIconContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,191,255,0.1)',
    borderRadius: radius.sm,
  },
fileInfo: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: 200,
  },
  fileName: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  fileSize: {
    color: colors.text.disabled,
    fontSize: 10,
  },
  removeButton: {
    padding: spacing.xs,
  },
  infoText: {
    color: colors.text.disabled,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default AttachmentPicker;

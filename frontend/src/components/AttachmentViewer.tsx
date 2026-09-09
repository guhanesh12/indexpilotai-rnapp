import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
  Linking,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../lib/theme';

export interface AttachmentFile {
  name: string;
  type: string;
  size: number;
  path?: string;
  url?: string;
}

interface AttachmentViewerProps {
  attachments: AttachmentFile[];
  title?: string;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Supabase storage constants
const SUPABASE_PROJECT = 'oklgqelcaujxntgjyuis';
const SUPABASE_URL = `https://${SUPABASE_PROJECT}.supabase.co`;

// Try to construct signed URL from path
function getSignedUrlFromPath(path: string): string {
  // If path already contains signed URL pattern, return as-is
  if (path.includes('/object/sign/') && path.includes('token=')) {
    return path;
  }
  
  // If it's a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Path is relative, try to construct signed URL pattern
  // Pattern: support/ticket_xxx/user/xxx.jpg -> /object/sign/make-c4d79cb7-files/support/ticket_xxx/user/xxx.jpg?token=EXPIRED
  // Since we can't generate valid tokens on frontend, we'll try public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`;
}

function getFullUrl(attachment: AttachmentFile): string {
  const { url, path } = attachment;
  
  // Priority 1: If we have a full signed URL from the API (contains /object/sign/ and token), use it
  if (url && url.includes('/object/sign/') && url.includes('token=')) {
    return url;
  }
  
  // Priority 2: If we have a full URL from the API, use it
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  
  // Priority 3: Try to get URL from path
  if (path) {
    return getSignedUrlFromPath(path);
  }
  
  // Fallback to url if path is empty
  if (url) {
    return url;
  }
  
  return '';
}

export function AttachmentViewer({ attachments, title = 'Attachments' }: AttachmentViewerProps) {
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingImageName, setViewingImageName] = useState<string>('');
  const [viewingVideo, setViewingVideo] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const handleAttachmentPress = (attachment: AttachmentFile) => {
    const { type, name } = attachment;
    const fullUri = getFullUrl(attachment);
    
    console.log('Opening attachment:', name, 'URL:', fullUri);
    
    if (!fullUri) {
      Alert.alert('Error', 'No URL available: ' + name);
      return;
    }

    if (type.startsWith('image/')) {
      setImageError(false);
      setImageLoading(true);
      setViewingImageName(name);
      setViewingImage(fullUri);
    } else if (type.startsWith('video/')) {
      setViewingVideo(fullUri);
    } else {
      Linking.openURL(fullUri).catch(() => {
        Alert.alert('Error', 'Unable to open file');
      });
    }
  };

  const closeImageModal = () => {
    setViewingImage(null);
    setViewingImageName('');
    setImageError(false);
  };

const renderAttachment = (attachment: AttachmentFile, index: number) => {
    const { type, name, size, url, path } = attachment;
    const isImage = type.startsWith('image/');
    const isVideo = type.startsWith('video/');
    
    // Use the same URL logic as getFullUrl for consistency
    const thumbUrl = getFullUrl(attachment);

    return (
      <TouchableOpacity
        key={`${name}-${index}`}
        style={styles.attachmentItem}
        onPress={() => handleAttachmentPress(attachment)}
        activeOpacity={0.7}
      >
        {isImage ? (
          thumbUrl ? (
            <Image 
              source={{ uri: thumbUrl }} 
              style={styles.thumbnail}
              onError={() => console.log('Thumb load error:', name)}
            />
          ) : (
            <View style={[styles.thumbnail, styles.imageThumbnail]}>
              <Ionicons name="image" size={28} color="#7C5CFF" />
            </View>
          )
        ) : isVideo ? (
          <View style={[styles.thumbnail, styles.videoThumbnail]}>
            <Ionicons name="play" size={24} color="#fff" />
          </View>
        ) : (
          <View style={styles.fileIconContainer}>
            <Ionicons name={getFileIcon(type)} size={24} color={colors.brand.primary} />
          </View>
        )}
        <Text style={styles.fileName} numberOfLines={2}>{name}</Text>
        <Text style={styles.fileSize}>{formatFileSize(size)}</Text>
      </TouchableOpacity>
    );
  };

  if (!attachments?.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.attachmentsGrid}
      >
        {attachments.map((attachment, index) => renderAttachment(attachment, index))}
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal visible={!!viewingImage} animationType="fade" transparent onRequestClose={closeImageModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{viewingImageName}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={closeImageModal}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.imageWrapper} onPress={closeImageModal} activeOpacity={1}>
            {imageLoading && <ActivityIndicator size="large" color="#7C5CFF" />}
            {imageError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color="#FF4444" />
                <Text style={styles.errorText}>Failed to load image</Text>
              </View>
            ) : (
<Image
                source={{ uri: viewingImage! }}
                style={styles.fullImage}
                resizeMode="contain"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
            )}
          </TouchableOpacity>
          
          <Text style={styles.hintText}>Tap to close</Text>
        </View>
      </Modal>

      {/* Video Modal */}
      <Modal visible={!!viewingVideo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Video</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setViewingVideo(null)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.videoWrapper}>
<Video
              source={{ uri: viewingVideo! }}
              style={styles.fullVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: spacing.sm },
  title: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  attachmentsGrid: { gap: spacing.sm, paddingRight: spacing.base },
  attachmentItem: { alignItems: 'center', width: 100 },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
  },
  imageThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,92,255,0.15)',
  },
  videoThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fileIconContainer: {
    width: 70,
    height: 70,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    color: colors.text.primary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 100,
  },
  fileSize: { color: colors.text.disabled, fontSize: 9, marginTop: 2 },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  fullVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  hintText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingBottom: 40,
    fontSize: 13,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 16,
    marginTop: 12,
  },
});

export default AttachmentViewer;

// YouTube APIキー
const API_KEY = 'AIzaSyDlkXxT6mEx8Iw1pF4Ku8wlznIU5SQPoC4'; // 実際のAPIキーに置き換えてください

// デフォルトのチャンネルID
const DEFAULT_CHANNEL_ID = 'UChwgNUWPM-ksOP3BbfQHS5Q';

// DOM要素
const channelIdInput = document.getElementById('channel-id');
const searchButton = document.getElementById('search-button');
const channelInfo = document.getElementById('channel-info');
const channelThumbnail = document.getElementById('channel-thumbnail');
const channelTitle = document.getElementById('channel-title');
const channelDescription = document.getElementById('channel-description');
const subscriberCount = document.getElementById('subscriber-count');
const videoCount = document.getElementById('video-count');
const videosContainer = document.getElementById('videos-container');
const loader = document.getElementById('loader');
const loadMoreButton = document.getElementById('load-more');
const loadMoreContainer = document.getElementById('load-more-container');
const sortSelect = document.getElementById('sort-select');
const sortFilterContainer = document.getElementById('sort-filter-container');
const errorContainer = document.getElementById('error-container');
const errorText = document.getElementById('error-text');
const retryButton = document.getElementById('retry-button');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const videoModal = document.getElementById('video-modal');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.querySelector('.modal-close');
const modalDescription = document.getElementById('modal-description');
const modalViewCount = document.getElementById('modal-view-count');
const modalPublishDate = document.getElementById('modal-publish-date');

// グローバル変数
let channelId = '';
let nextPageToken = '';
let currentSort = 'date';
let player = null;
let currentVideoData = {};
let isDarkMode = false;
let videosCache = new Map();
let channelCache = new Map();

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', initialize);

// イベントリスナー
searchButton.addEventListener('click', searchChannel);
loadMoreButton.addEventListener('click', loadMoreVideos);
sortSelect.addEventListener('change', handleSortChange);
retryButton.addEventListener('click', retryLastOperation);
modalClose.addEventListener('click', closeVideoModal);
themeToggleBtn.addEventListener('click', toggleTheme);
channelIdInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchChannel();
    }
});

// モーダルの外側をクリックしたら閉じる
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeVideoModal();
    }
});

// キーボードのEscキーでモーダルを閉じる
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && !videoModal.classList.contains('hidden')) {
        closeVideoModal();
    }
});

// テーマ設定の復元
function initialize() {
    // ローカルストレージからテーマ設定を復元
    if (localStorage.getItem('theme') === 'dark') {
        setDarkMode(true);
    }
    
    // 指定されたチャンネルIDのコンテンツを初期表示
    channelIdInput.value = DEFAULT_CHANNEL_ID;
    searchChannel();
}

// チャンネル検索と初期ビデオロード
async function searchChannel() {
    const query = channelIdInput.value.trim();
    
    if (!query) {
        showError('チャンネルIDまたはユーザー名を入力してください');
        return;
    }
    
    showLoader();
    resetPage();
    
    try {
        // チャンネルIDを取得（ユーザー名またはチャンネルIDから）
        channelId = await getChannelId(query);
        
        if (!channelId) {
            showError('チャンネルが見つかりませんでした。正しいチャンネルIDまたはユーザー名を入力してください。');
            return;
        }
        
        // チャンネル情報を取得
        await getChannelInfo(channelId);
        
        // チャンネルの動画を取得
        await getChannelVideos(channelId);
        
        // 並び替えオプションを表示
        sortFilterContainer.classList.remove('hidden');
        
    } catch (error) {
        console.error('エラーが発生しました:', error);
        showError(`エラーが発生しました：${error.message || 'ネットワークエラーまたはAPIエラー'}`);
    } finally {
        hideLoader();
    }
}

// エラーメッセージを表示
function showError(message) {
    errorText.textContent = message;
    errorContainer.classList.remove('hidden');
    hideLoader();
}

// 最後の操作を再試行
function retryLastOperation() {
    errorContainer.classList.add('hidden');
    searchChannel();
}

// チャンネルIDを取得
async function getChannelId(query) {
    // キャッシュをチェック
    if (channelCache.has(query)) {
        return channelCache.get(query);
    }
    
    // チャンネルID形式をチェック
    if (/^UC[\w-]{22}$/.test(query)) {
        channelCache.set(query, query);
        return query; // すでにチャンネルID形式ならそのまま返す
    }
    
    try {
        // ユーザー名からチャンネルIDを検索
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(query)}&key=${API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`API応答エラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const id = data.items[0].snippet.channelId;
            channelCache.set(query, id);
            return id;
        }
        
        return null;
    } catch (error) {
        console.error('チャンネルID取得エラー:', error);
        throw error;
    }
}

// チャンネル情報を取得
async function getChannelInfo(channelId) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`API応答エラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const channel = data.items[0];
            
            // チャンネル情報を表示
            const thumbnailUrl = channel.snippet.thumbnails.high ? channel.snippet.thumbnails.high.url : channel.snippet.thumbnails.default.url;
            channelThumbnail.src = thumbnailUrl;
            channelThumbnail.alt = `${channel.snippet.title}のサムネイル`;
            channelTitle.textContent = channel.snippet.title;
            
            // チャンネルの説明
            const fullDescription = channel.snippet.description;
            channelDescription.textContent = fullDescription || 'チャンネルの説明はありません。';
            
            // 登録者数をフォーマット
            const subCount = parseInt(channel.statistics.subscriberCount);
            subscriberCount.innerHTML = `<i class="fas fa-users"></i> チャンネル登録者数: ${formatNumber(subCount)}人`;
            
            // 動画数
            const vidCount = parseInt(channel.statistics.videoCount);
            videoCount.innerHTML = `<i class="fas fa-video"></i> 動画数: ${vidCount}本`;
            
            // チャンネル情報を表示
            channelInfo.classList.remove('hidden');
            
            // ページタイトルを更新
            document.title = `${channel.snippet.title} - JaruTube Premium`;
        }
    } catch (error) {
        console.error('チャンネル情報取得エラー:', error);
        throw error;
    }
}

// 並び替えの変更を処理
function handleSortChange() {
    currentSort = sortSelect.value;
    resetVideoList();
    getChannelVideos(channelId);
}

// チャンネルの動画を取得
async function getChannelVideos(channelId, pageToken = '') {
    showLoader();
    const maxResults = 12;
    const cacheKey = `${channelId}-${currentSort}-${pageToken}`;
    
    try {
        // キャッシュをチェック
        if (videosCache.has(cacheKey)) {
            const cachedData = videosCache.get(cacheKey);
            nextPageToken = cachedData.nextPageToken || '';
            await displayVideos(cachedData.items);
            
            if (nextPageToken) {
                loadMoreContainer.classList.remove('hidden');
            } else {
                loadMoreContainer.classList.add('hidden');
            }
            
            return;
        }
        
        let url;
        
        if (currentSort === 'date') {
            // 日付順（新しい順）
            url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&order=date&type=video&key=${API_KEY}`;
        } else {
            // まず動画IDを取得
            const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&type=video&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`);
            
            if (!searchResponse.ok) {
                throw new Error(`API応答エラー: ${searchResponse.status}`);
            }
            
            const searchData = await searchResponse.json();
            nextPageToken = searchData.nextPageToken || '';
            
            // 動画IDを取得して詳細情報をリクエスト
            if (searchData.items && searchData.items.length > 0) {
                const videoIds = searchData.items.map(item => item.id.videoId).join(',');
                url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${API_KEY}`;
                
                const videoResponse = await fetch(url);
                
                if (!videoResponse.ok) {
                    throw new Error(`API応答エラー: ${videoResponse.status}`);
                }
                
                const videoData = await videoResponse.json();
                
                if (videoData.items && videoData.items.length > 0) {
                    // 並び替え
                    if (currentSort === 'viewCount') {
                        videoData.items.sort((a, b) => 
                            parseInt(b.statistics.viewCount || 0) - parseInt(a.statistics.viewCount || 0)
                        );
                    } else if (currentSort === 'rating') {
                        videoData.items.sort((a, b) => {
                            const aRatio = parseInt(a.statistics.likeCount || 0);
                            const bRatio = parseInt(b.statistics.likeCount || 0);
                            return bRatio - aRatio;
                        });
                    }
                    
                    // キャッシュに保存
                    videosCache.set(cacheKey, {
                        items: videoData.items,
                        nextPageToken: nextPageToken
                    });
                    
                    // 動画を表示
                    await displayVideos(videoData.items);
                    
                    // 「もっと見る」ボタンの表示/非表示を切り替え
                    if (nextPageToken) {
                        loadMoreContainer.classList.remove('hidden');
                    } else {
                        loadMoreContainer.classList.add('hidden');
                    }
                    
                    return;
                }
            }
            
            videosContainer.innerHTML = '<p class="no-results">このチャンネルには動画がありません。</p>';
            return;
        }
        
        if (pageToken) {
            url += `&pageToken=${pageToken}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API応答エラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            // 次ページがあれば保存
            nextPageToken = data.nextPageToken || '';
            
            // キャッシュに保存
            videosCache.set(cacheKey, {
                items: data.items,
                nextPageToken: nextPageToken
            });
            
            // 動画リストを作成
            await displayVideos(data.items);
            
            // 「もっと見る」ボタンの表示/非表示を切り替え
            if (nextPageToken) {
                loadMoreContainer.classList.remove('hidden');
            } else {
                loadMoreContainer.classList.add('hidden');
            }
        } else {
            videosContainer.innerHTML = '<p class="no-results">このチャンネルには動画がありません。</p>';
        }
    } catch (error) {
        console.error('動画取得エラー:', error);
        showError(`動画の取得中にエラーが発生しました：${error.message || 'ネットワークエラーまたはAPIエラー'}`);
    } finally {
        hideLoader();
    }
}

// 動画を表示
async function displayVideos(videos) {
    // 各動画のIDを集める
    let videoIds;
    
    if (videos[0].kind === 'youtube#searchResult') {
        videoIds = videos.map(item => item.id.videoId).join(',');
    } else {
        // すでにvideoデータが来ている場合
        return displayVideoDetails(videos);
    }
    
    try {
        // 動画の詳細情報を取得
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`API応答エラー: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            displayVideoDetails(data.items);
        }
    } catch (error) {
        console.error('動画詳細情報取得エラー:', error);
        throw error;
    }
}

// 動画の詳細情報を表示
function displayVideoDetails(videoDetails) {
    videoDetails.forEach(video => {
        const videoId = video.id;
        const snippet = video.snippet;
        const statistics = video.statistics || {};
        
        // 日付のフォーマット
        const publishedAt = new Date(snippet.publishedAt);
        const formattedDate = formatDate(publishedAt);
        
        // 視聴回数
        const viewCount = statistics.viewCount ? parseInt(statistics.viewCount) : 0;
        
        // 動画の長さ
        const duration = video.contentDetails?.duration;
        const formattedDuration = duration ? formatDuration(duration) : '';
        
        // 動画カードを作成
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.dataset.videoId = videoId;
        videoCard.dataset.title = snippet.title;
        videoCard.dataset.viewCount = viewCount;
        videoCard.dataset.publishDate = formattedDate;
        videoCard.dataset.description = snippet.description;
        
        videoCard.innerHTML = `
            <div class="thumbnail-container">
                <img class="video-thumbnail" src="${snippet.thumbnails.high ? snippet.thumbnails.high.url : snippet.thumbnails.default.url}" alt="${snippet.title}">
                <div class="play-icon">
                    <i class="fas fa-play"></i>
                </div>
                <span class="duration">${formattedDuration}</span>
            </div>
            <div class="video-info">
                <h3 class="video-title">${snippet.title}</h3>
                <div class="video-meta">
                    <span><i class="fas fa-eye"></i> ${formatNumber(viewCount)}回視聴</span>
                    <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
                </div>
            </div>
        `;
        
        // クリックイベントを追加
        videoCard.addEventListener('click', function() {
            openVideoModal(video);
        });
        
        videosContainer.appendChild(videoCard);
    });
}

// 動画モーダルを開く
function openVideoModal(videoData) {
    currentVideoData = videoData;
    
    // モーダルにデータを設定
    modalTitle.textContent = videoData.snippet.title;
    modalViewCount.innerHTML = `<i class="fas fa-eye"></i> ${formatNumber(parseInt(videoData.statistics?.viewCount || 0))}回視聴`;
    modalPublishDate.innerHTML = `<i class="fas fa-calendar-alt"></i> ${formatDate(new Date(videoData.snippet.publishedAt))}`;
    modalDescription.textContent = videoData.snippet.description;
    
    // YouTube Player APIでプレーヤーを初期化
    if (player) {
        player.loadVideoById(videoData.id);
    } else {
        player = new YT.Player('video-player', {
            height: '100%',
            width: '100%',
            videoId: videoData.id,
            playerVars: {
                autoplay: 1,
                modestbranding: 1,
                rel: 0
            }
        });
    }
    
    // モーダルを表示
    videoModal.classList.remove('hidden');
    videoModal.setAttribute('aria-hidden', 'false');
    
    // スクロール防止
    document.body.style.overflow = 'hidden';
}

// 動画モーダルを閉じる
function closeVideoModal() {
    videoModal.classList.add('hidden');
    videoModal.setAttribute('aria-hidden', 'true');
    
    // プレーヤーを停止
    if (player) {
        player.stopVideo();
    }
    
    // スクロール許可
    document.body.style.overflow = '';
}

// 「もっと見る」ボタンで追加の動画を読み込む
async function loadMoreVideos() {
    if (nextPageToken) {
        try {
            await getChannelVideos(channelId, nextPageToken);
        } catch (error) {
            console.error('動画の読み込み中にエラーが発生しました:', error);
            showError(`動画の読み込み中にエラーが発生しました：${error.message || 'ネットワークエラーまたはAPIエラー'}`);
        }
    }
}

// 動画リストをリセット
function resetVideoList() {
    videosContainer.innerHTML = '';
    nextPageToken = '';
    loadMoreContainer.classList.add('hidden');
}

// ページをリセット
function resetPage() {
    resetVideoList();
    channelInfo.classList.add('hidden');
    errorContainer.classList.add('hidden');
    sortFilterContainer.classList.add('hidden');
}

// ダークモード切り替え
function toggleTheme() {
    setDarkMode(!isDarkMode);
}

// ダークモード設定
function setDarkMode(enabled) {
    isDarkMode = enabled;
    if (enabled) {
        document.body.setAttribute('data-theme', 'dark');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.removeAttribute('data-theme');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    }
}

// 数字を読みやすい形式にフォーマット
function formatNumber(num) {
    if (num >= 10000000) {
        return (num / 10000000).toFixed(1) + '千万';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + '百万';
    } else if (num >= 10000) {
        return (num / 10000).toFixed(1) + '万';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + '千';
    } else {
        return num.toString();
    }
}

// ISO 8601形式の動画長さをフォーマット
function formatDuration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) return '';
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// 日付をフォーマット
function formatDate(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
        return '今日';
    } else if (diffDays < 2) {
        return '昨日';
    } else if (diffDays < 7) {
        return `${diffDays}日前`;
    } else if (diffDays < 30) {
        return `${Math.floor(diffDays / 7)}週間前`;
    } else if (diffDays < 365) {
        return `${Math.floor(diffDays / 30)}ヶ月前`;
    } else {
        return `${Math.floor(diffDays / 365)}年前`;
    }
}

// ローディング表示
function showLoader() {
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}